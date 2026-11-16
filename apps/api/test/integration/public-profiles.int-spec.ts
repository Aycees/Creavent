import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp } from './app.js';
import { assignedSlot, eventParts } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// Features 4.4 and 4.5: the organizer and vendor pages (spec §7.1, §7.2,
// data model §7).
describe('the organizer and vendor pages', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;

  const day = 86_400_000;
  const soon = (days: number, hours = 6) => ({ startsAt: new Date(Date.now() + days * day), endsAt: new Date(Date.now() + days * day + hours * 3_600_000) });

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

  const get = (path: string) => request(app.getHttpServer()).get(`/api/public/${path}`);

  describe('organizer page', () => {
    async function setup() {
      const organizer = await createOrganizer(prisma, { displayName: 'Sari-Sari Collective' });
      await prisma.organizerProfile.update({
        where: { id: organizer.profile.id },
        data: { about: 'Night markets since 2022.', city: 'Davao City', socialLinks: ['https://facebook.com/sarisari'] },
      });
      const later = await readyEvent(prisma, organizer.profile.id, { status: 'announced', name: 'Paskong Ukay Night', ...soon(20) });
      const next = await readyEvent(prisma, organizer.profile.id, { status: 'announced', name: 'Matina Night Flea', ...soon(5) });
      const october = await readyEvent(prisma, organizer.profile.id, { status: 'completed', name: 'Matina Night Flea, October', ...soon(-30) });
      await readyEvent(prisma, organizer.profile.id, { status: 'completed', name: 'Matina Night Flea, September', ...soon(-60) });
      // Not shown: open to vendors, a draft, canceled, hidden.
      await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', name: 'Bajada Christmas Flea', ...soon(25) });
      await readyEvent(prisma, organizer.profile.id, { name: 'A draft', ...soon(30) });
      await readyEvent(prisma, organizer.profile.id, { status: 'canceled', name: 'Canceled one', ...soon(8) });
      await readyEvent(prisma, organizer.profile.id, { status: 'completed', name: 'Hidden one', moderationState: 'hidden', ...soon(-10) });
      return { organizer, later, next, october };
    }

    it('shows the profile, upcoming announced events, and past completed ones', async () => {
      const { organizer, later, next, october } = await setup();

      const res = await get(`organizers/${organizer.profile.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.organizer).toMatchObject({
        displayName: 'Sari-Sari Collective',
        approved: true,
        about: 'Night markets since 2022.',
        city: 'Davao City',
        socialLinks: ['https://facebook.com/sarisari'],
        eventsHeld: 2,
      });
      expect(res.body.organizer.joinedAt).toEqual(expect.any(String));
      expect(res.body.upcoming.map((e: { name: string }) => e.name)).toEqual(['Matina Night Flea', 'Paskong Ukay Night']);
      expect(res.body.past.map((e: { name: string }) => e.name)).toEqual(['Matina Night Flea, October', 'Matina Night Flea, September']);
      expect(res.body.tags).toEqual(expect.arrayContaining([`organizer:${organizer.profile.id}`, `event:${next}`, `event:${later}`, `event:${october}`]));
      // Contact details never show (spec §7).
      expect(JSON.stringify(res.body)).not.toMatch(/0917|@/);
    });

    it('shows no seal while the organizer is not approved', async () => {
      const organizer = await createOrganizer(prisma, { approvalStatus: 'pending_review' });

      const res = await get(`organizers/${organizer.profile.slug}`);

      expect(res.body.organizer.approved).toBe(false);
    });

    it('is Not found while suspended, once deleted, or for an unknown link', async () => {
      const suspended = await createOrganizer(prisma, { suspendedAt: new Date() });
      const deleted = await createOrganizer(prisma);
      await prisma.user.update({ where: { id: deleted.user.id }, data: { deletedAt: new Date() } });

      for (const slug of [suspended.profile.slug, deleted.profile.slug, 'nobody-here']) {
        expect((await get(`organizers/${slug}`)).status).toBe(404);
      }
    });
  });

  describe('vendor page', () => {
    async function soldAt(vendorProfileId: string, eventId: string, slot: number, organizerUserId: string, reserved = true) {
      const parts = await eventParts(prisma, eventId);
      const s = await assignedSlot(prisma, { eventId, vendorProfileId, categoryId: parts.preloved.id, slotId: parts.slots[slot]!.id, organizerUserId });
      if (reserved) await prisma.slotAssignment.update({ where: { id: s.assignment.id }, data: { status: 'reserved', reservedAt: new Date() } });
      return s;
    }

    async function setup() {
      const organizer = await createOrganizer(prisma, { displayName: 'Sari-Sari Collective' });
      const preloved = await prisma.category.findFirstOrThrow({ where: { slug: 'preloved-clothing' } });
      const vendor = await createVendor(prisma, [preloved.id]);
      await prisma.vendorProfile.update({
        where: { id: vendor.profile.id },
        data: { description: 'Hand-picked preloved tops.', products: 'Tops, denim', city: 'Davao City', socialLinks: ['https://instagram.com/lolasukay'] },
      });
      const e = (status: 'announced' | 'completed' | 'open_to_vendors' | 'canceled', name: string, days: number) =>
        readyEvent(prisma, organizer.profile.id, { status, name, ...soon(days) });
      const next = await e('announced', 'Matina Night Flea', 5);
      const after = await e('announced', 'Paskong Ukay Night', 20);
      const past = await e('completed', 'Matina Night Flea, October', -30);
      const openOnly = await e('open_to_vendors', 'Bajada Christmas Flea', 10);
      const canceled = await e('canceled', 'Kadayawan Rain Market', 12);
      const unpaid = await e('announced', 'Toril Sunday Ukay', 3);
      await soldAt(vendor.profile.id, next, 0, organizer.user.id);
      await soldAt(vendor.profile.id, after, 1, organizer.user.id);
      await soldAt(vendor.profile.id, past, 0, organizer.user.id);
      await soldAt(vendor.profile.id, openOnly, 0, organizer.user.id);
      const c = await soldAt(vendor.profile.id, canceled, 0, organizer.user.id);
      await prisma.slotAssignment.update({ where: { id: c.assignment.id }, data: { status: 'canceled' } });
      await soldAt(vendor.profile.id, unpaid, 0, organizer.user.id, false);
      return { vendor, next, after, past };
    }

    it('shows the profile, where to find them next, and where they have sold', async () => {
      const { vendor, next, after, past } = await setup();

      const res = await get(`vendors/${vendor.profile.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.vendor).toMatchObject({
        shopName: "Lola's Ukay",
        categories: ['Preloved clothing'],
        description: 'Hand-picked preloved tops.',
        products: 'Tops, denim',
        city: 'Davao City',
        socialLinks: ['https://instagram.com/lolasukay'],
        photos: [],
        eventsSoldAt: 3,
      });
      expect(res.body.next).toMatchObject({ slotLabel: 'A-01', event: { name: 'Matina Night Flea', organizer: { displayName: 'Sari-Sari Collective' } } });
      expect(res.body.sold.map((s: { name: string; slotLabel: string; upcoming: boolean }) => [s.name, s.slotLabel, s.upcoming])).toEqual([
        ['Paskong Ukay Night', 'A-02', true],
        ['Matina Night Flea', 'A-01', true],
        ['Matina Night Flea, October', 'A-01', false],
      ]);
      expect(res.body.tags).toEqual(expect.arrayContaining([`vendor:${vendor.profile.id}`, `event:${next}`, `event:${after}`, `event:${past}`]));
      // Never shown publicly (spec §7.2).
      expect(JSON.stringify(res.body)).not.toMatch(/0918|@|amount|payment/i);
    });

    it('has no next event and an empty list for a new vendor', async () => {
      const vendor = await createVendor(prisma);

      const res = await get(`vendors/${vendor.profile.slug}`);

      expect(res.body).toMatchObject({ next: null, sold: [], vendor: { eventsSoldAt: 0 } });
    });

    it('is Not found while the vendor role is suspended, once deleted, or for an unknown link', async () => {
      const suspended = await createVendor(prisma);
      await prisma.userRole.update({ where: { userId_role: { userId: suspended.user.id, role: 'vendor' } }, data: { suspendedAt: new Date() } });
      const deleted = await createVendor(prisma);
      await prisma.user.update({ where: { id: deleted.user.id }, data: { deletedAt: new Date() } });

      for (const slug of [suspended.profile.slug, deleted.profile.slug, 'nobody-here']) {
        expect((await get(`vendors/${slug}`)).status).toBe(404);
      }
    });
  });
});
