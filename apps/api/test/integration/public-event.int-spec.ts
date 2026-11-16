import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, signInAs } from './app.js';
import { assignedSlot, eventParts } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// Feature 4.2: the public event page (sitemap §3, spec §7, decision Q2).
describe('the public event page', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const publicPage = (slug: string) => request(app.getHttpServer()).get(`/api/public/events/${slug}`);

  async function event(status: 'draft' | 'open_to_vendors' | 'announced' | 'completed' | 'canceled', extra: Parameters<typeof readyEvent>[2] = {}) {
    const organizer = await createOrganizer(prisma);
    const id = await readyEvent(prisma, organizer.profile.id, { status, ...extra });
    const e = await prisma.event.findUniqueOrThrow({ where: { id } });
    return { organizer, id, slug: e.slug };
  }

  async function reservedVendor(eventId: string, organizerUserId: string, slot: number, shopName: string) {
    const parts = await eventParts(prisma, eventId);
    const vendor = await createVendor(prisma, [parts.preloved.id]);
    await prisma.vendorProfile.update({ where: { id: vendor.profile.id }, data: { shopName } });
    const s = await assignedSlot(prisma, { eventId, vendorProfileId: vendor.profile.id, categoryId: parts.preloved.id, slotId: parts.slots[slot]!.id, organizerUserId });
    await prisma.slotAssignment.update({ where: { id: s.assignment.id }, data: { status: 'reserved', reservedAt: new Date() } });
    return { vendor, ...s };
  }

  it('shows an announced event with its organizer and the vendors with a reserved slot', async () => {
    const { organizer, id, slug } = await event('announced');
    await prisma.organizerProfile.update({ where: { id: organizer.profile.id }, data: { about: 'Night markets since 2022.', socialLinks: ['https://facebook.com/balikgamit'] } });
    await readyEvent(prisma, organizer.profile.id, { status: 'completed' });
    const lola = await reservedVendor(id, organizer.user.id, 0, "Lola's Ukay");
    const parts = await eventParts(prisma, id);
    const unpaid = await createVendor(prisma, [parts.preloved.id]);
    await assignedSlot(prisma, { eventId: id, vendorProfileId: unpaid.profile.id, categoryId: parts.preloved.id, slotId: parts.slots[1]!.id, organizerUserId: organizer.user.id });

    const res = await publicPage(slug);

    expect(res.status).toBe(200);
    expect(res.body.page.view).toBe('public');
    expect(res.body.page.event).toMatchObject({
      slug,
      typeName: 'Flea market',
      status: 'announced',
      startDate: '2027-01-15',
      endDate: '2027-01-17',
      opensAt: '17:00',
      closesAt: '23:00',
      venueName: 'Damosa Gateway',
      canceled: null,
      organizer: { displayName: 'Balik-Gamit Davao', approved: true, about: 'Night markets since 2022.', socialLinks: ['https://facebook.com/balikgamit'], eventsHeld: 1 },
      vendors: [{ shopName: "Lola's Ukay", slug: lola.vendor.profile.slug, categories: ['Preloved clothing'], slotLabel: 'A-01' }],
    });
    // Contact details and payment facts never show publicly (spec §7.2).
    expect(JSON.stringify(res.body)).not.toContain('0917');
    expect(res.body.tags).toEqual(expect.arrayContaining([`event:${id}`, `organizer:${organizer.profile.id}`, `vendor:${lola.vendor.profile.id}`]));
  });

  it('lists a suspended vendor without a link and a deleted one as Deleted user', async () => {
    const { organizer, id, slug } = await event('announced');
    const suspended = await reservedVendor(id, organizer.user.id, 0, 'Second Spin Records');
    await prisma.userRole.update({ where: { userId_role: { userId: suspended.vendor.user.id, role: 'vendor' } }, data: { suspendedAt: new Date() } });
    const deleted = await reservedVendor(id, organizer.user.id, 1, 'Habi Mindanao');
    await prisma.user.update({ where: { id: deleted.vendor.user.id }, data: { deletedAt: new Date() } });

    const res = await publicPage(slug);

    expect(res.body.page.event.vendors).toEqual([
      expect.objectContaining({ shopName: 'Second Spin Records', slug: null }),
      expect.objectContaining({ shopName: 'Deleted user', slug: null, avatarUrl: null }),
    ]);
  });

  it('says an event open to vendors is not public yet', async () => {
    const { slug } = await event('open_to_vendors');

    const res = await publicPage(slug);

    expect(res.status).toBe(200);
    expect(res.body.page).toEqual({ view: 'not_public' });
  });

  it('is Not found for a draft, a hidden event, and a missing slug', async () => {
    const draft = await event('draft');
    const hidden = await event('announced', { moderationState: 'hidden' });

    for (const slug of [draft.slug, hidden.slug, 'no-such-event']) {
      expect((await publicPage(slug)).status).toBe(404);
    }
  });

  it('shows a canceled announced event with the reason and no vendors', async () => {
    const { organizer, id, slug } = await event('announced');
    await reservedVendor(id, organizer.user.id, 0, "Lola's Ukay");
    const browser = await signInAs(app, organizer.user.email);
    await browser.post(`/api/organizer/events/${id}/cancel`).send({ reason: 'Typhoon signal 2.' });

    const res = await publicPage(slug);

    expect(res.body.page.view).toBe('public');
    expect(res.body.page.event).toMatchObject({ status: 'canceled', vendors: [], canceled: { reason: 'Typhoon signal 2.' } });
  });

  it('shows only the name and dates of an event canceled before it was announced', async () => {
    const { organizer, id, slug } = await event('open_to_vendors');
    const browser = await signInAs(app, organizer.user.email);
    await browser.post(`/api/organizer/events/${id}/cancel`).send({ reason: 'Venue fell through.' });

    const res = await publicPage(slug);

    expect(res.body.page).toEqual({
      view: 'canceled_notice',
      name: expect.any(String),
      startDate: '2027-01-15',
      endDate: '2027-01-17',
      opensAt: '17:00',
      closesAt: '23:00',
      canceled: { at: expect.any(String), reason: 'Venue fell through.' },
    });
  });

  describe('for signed-in viewers', () => {
    it("shows the event's organizer the public view with Manage event, at any status", async () => {
      const { organizer, id, slug } = await event('open_to_vendors');
      const browser = await signInAs(app, organizer.user.email);

      const res = await browser.get(`/api/events/${slug}`);

      expect(res.body).toMatchObject({ view: 'public', manage: { eventId: id }, event: { slug, status: 'open_to_vendors' } });
    });

    it('shows the organizer the vendor view when previewing as a vendor', async () => {
      const { organizer, slug } = await event('announced');
      const browser = await signInAs(app, organizer.user.email);

      const res = await browser.get(`/api/events/${slug}?as=vendor`);

      expect(res.body).toMatchObject({ view: 'vendor', preview: true });
    });

    it('keeps the vendor view for vendors, completed and canceled events included', async () => {
      const completed = await event('completed');
      const vendor = await createVendor(prisma);
      const browser = await signInAs(app, vendor.user.email);

      const res = await browser.get(`/api/events/${completed.slug}`);

      expect(res.body).toMatchObject({ view: 'vendor', preview: false, event: { status: 'completed' } });
    });

    it('shows other signed-in users the public page', async () => {
      const announced = await event('announced');
      const other = await createOrganizer(prisma);
      const browser = await signInAs(app, other.user.email);

      const res = await browser.get(`/api/events/${announced.slug}`);

      expect(res.body).toMatchObject({ view: 'public', manage: null });
    });
  });
});
