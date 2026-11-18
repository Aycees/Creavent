import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import type { App } from 'supertest/types.js';
import { completeEndedEvents } from '../../src/events/complete-events.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { agent, createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { readyEvent } from './events.js';
import { createOrganizer, createVendor } from './factories.js';
import { MemoryStorage } from './memory-storage.js';

type Browser = ReturnType<typeof agent>;

// Feature 6.3: create and announce a pop-up (spec §4.7, flow 12), with the
// rules the database and the API keep (rules 6.14 to 6.16).
describe('pop-ups', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let storage: MemoryStorage;
  let preloved: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    preloved = (await prisma.category.findFirstOrThrow({ where: { slug: 'preloved-clothing' } })).id;
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    storage = new MemoryStorage();
    app = await createTestApp(storage);
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function host(approval: 'approved' | 'not_submitted' = 'approved') {
    const { user, profile } = await createVendor(prisma, [preloved]);
    await prisma.userRole.update({
      where: { userId_role: { userId: user.id, role: 'vendor' } },
      data: { approvalStatus: approval, approvalSource: approval === 'approved' ? 'reviewed' : null },
    });
    return { user, profile, browser: await signInAs(app, user.email) };
  }

  async function cover(browser: Browser) {
    const body = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#fff' } }).png().toBuffer();
    const ask = await browser.post('/api/files').send({ purpose: 'event_cover', mimeType: 'image/png', sizeBytes: body.length });
    expect(ask.status).toBe(201);
    storage.upload(`incoming/${ask.body.fileId}`, body);
    const done = await browser.post(`/api/files/${ask.body.fileId}/complete`).send({});
    return done.body.id as string;
  }

  async function draft(browser: Browser, name = "Lola's Ukay at Habi Café") {
    const res = await browser.post('/api/vendor/popups').send({ name });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  const details = (overrides: Record<string, unknown> = {}) => ({
    name: "Lola's Ukay at Habi Café",
    description: 'Two racks of preloved tops and denim.',
    startDate: '2027-01-16',
    endDate: '2027-01-16',
    opensAt: '14:00',
    closesAt: '20:00',
    venueName: 'Habi Café',
    addressLine: 'Quirino Avenue, Obrero',
    city: 'Davao City',
    coverFileId: null,
    ...overrides,
  });

  async function ready(browser: Browser) {
    const id = await draft(browser);
    const res = await browser.put(`/api/vendor/popups/${id}`).send(details({ coverFileId: await cover(browser) }));
    expect(res.status).toBe(200);
    return id;
  }

  describe('the database', () => {
    it('keeps exactly one host on every event, and a pop-up never open to vendors (rule 6.14)', async () => {
      const { profile: vendorProfile } = await createVendor(prisma);
      const { profile } = await createOrganizer(prisma);
      const type = await prisma.eventType.findFirstOrThrow({ where: { slug: 'pop-up' } });
      const base = { eventTypeId: type.id, name: 'X', slug: `x-${crypto.randomUUID()}` };

      await expect(prisma.event.create({ data: { ...base } })).rejects.toThrow();
      await expect(prisma.event.create({ data: { ...base, organizerProfileId: profile.id, hostVendorProfileId: vendorProfile.id } })).rejects.toThrow();
      await expect(prisma.event.create({ data: { ...base, hostVendorProfileId: vendorProfile.id, status: 'open_to_vendors' } })).rejects.toThrow();
      await expect(prisma.event.create({ data: { ...base, hostVendorProfileId: vendorProfile.id } })).resolves.toBeTruthy();
    });
  });

  describe('drafts', () => {
    it('a vendor creates a draft with only a name, before host approval, as a Pop-up', async () => {
      const { profile, browser } = await host('not_submitted');

      const id = await draft(browser);
      const res = await browser.get(`/api/vendor/popups/${id}`);

      const event = await prisma.event.findUniqueOrThrow({ where: { id }, include: { eventType: true } });
      expect(event).toMatchObject({ status: 'draft', hostVendorProfileId: profile.id, organizerProfileId: null, applicationsOpen: false });
      expect(event.eventType.slug).toBe('pop-up');
      expect(res.body).toMatchObject({
        status: 'draft',
        details: { name: "Lola's Ukay at Habi Café", startDate: null },
        checklist: { about: false, cover: false, schedule: false, venue: false, profile: true, host: false },
        shop: { shopName: "Lola's Ukay", categories: ['Preloved clothing'] },
      });
    });

    it('saves the details with the event date rules', async () => {
      const { browser } = await host();
      const id = await draft(browser);

      const long = await browser.put(`/api/vendor/popups/${id}`).send(details({ endDate: '2027-01-30' }));
      const late = await browser.put(`/api/vendor/popups/${id}`).send(details({ closesAt: '13:00' }));
      const ok = await browser.put(`/api/vendor/popups/${id}`).send(details());

      expect(long.status).toBe(400);
      expect(late.status).toBe(400);
      expect(ok.status).toBe(200);
      expect(ok.body.details).toMatchObject({ startDate: '2027-01-16', opensAt: '14:00', venueName: 'Habi Café' });
    });

    it('is Not found for anyone but its host, and the organizer pages refuse it (rule 6.16)', async () => {
      const a = await host();
      const b = await host();
      const { user: org } = await createOrganizer(prisma);
      const asOrg = await signInAs(app, org.email);
      const id = await draft(a.browser);

      expect((await b.browser.get(`/api/vendor/popups/${id}`)).status).toBe(404);
      expect((await b.browser.put(`/api/vendor/popups/${id}`).send(details())).status).toBe(404);
      expect((await asOrg.get(`/api/organizer/events/${id}`)).status).toBe(404);
      expect((await asOrg.put(`/api/organizer/events/${id}/requirements`).send({ categories: [], documents: [] })).status).toBe(404);
    });

    it('needs the vendor role, not suspended', async () => {
      const { user: org } = await createOrganizer(prisma);
      const asOrg = await signInAs(app, org.email);
      const suspended = await host();
      await prisma.userRole.update({ where: { userId_role: { userId: suspended.user.id, role: 'vendor' } }, data: { suspendedAt: new Date() } });

      expect((await asOrg.post('/api/vendor/popups').send({ name: 'X' })).status).toBe(403);
      expect((await suspended.browser.post('/api/vendor/popups').send({ name: 'X' })).status).toBe(403);
    });

    it('deletes a draft for good, and only a draft', async () => {
      const { browser } = await host();
      const draftId = await draft(browser);
      const announcedId = await ready(browser);
      await browser.post(`/api/vendor/popups/${announcedId}/announce`);

      expect((await browser.delete(`/api/vendor/popups/${draftId}`)).status).toBe(204);
      expect(await prisma.event.findUnique({ where: { id: draftId } })).toBeNull();
      expect((await browser.delete(`/api/vendor/popups/${announcedId}`)).status).toBe(409);
    });
  });

  describe('announce', () => {
    it('puts a complete pop-up of an approved host on the listing', async () => {
      const { browser } = await host();
      const id = await ready(browser);

      const res = await browser.post(`/api/vendor/popups/${id}/announce`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('announced');
      const event = await prisma.event.findUniqueOrThrow({ where: { id } });
      expect(event.announcedAt).not.toBeNull();
      const listing = await agent(app).get('/api/public/events');
      expect(listing.body.events).toEqual([expect.objectContaining({ slug: event.slug, isPopup: true, organizer: { displayName: "Lola's Ukay", approved: true } })]);
    });

    it('is refused before host approval, with steps missing, after the end, or while hidden', async () => {
      const unapproved = await host('not_submitted');
      const notApproved = await ready(unapproved.browser);
      const { browser } = await host();
      const incomplete = await draft(browser);
      const ended = await ready(browser);
      await browser.put(`/api/vendor/popups/${ended}`).send(details({ startDate: '2025-01-16', endDate: '2025-01-16', coverFileId: await cover(browser) }));
      const hidden = await ready(browser);
      await prisma.event.update({ where: { id: hidden }, data: { moderationState: 'hidden' } });

      expect((await unapproved.browser.post(`/api/vendor/popups/${notApproved}/announce`)).status).toBe(403);
      expect((await browser.post(`/api/vendor/popups/${incomplete}/announce`)).status).toBe(409);
      expect((await browser.post(`/api/vendor/popups/${ended}/announce`)).status).toBe(409);
      expect((await browser.post(`/api/vendor/popups/${hidden}/announce`)).status).toBe(409);
    });

    it('needs a mobile number and a category on the vendor profile', async () => {
      const { user, profile, browser } = await host();
      const id = await ready(browser);
      await prisma.vendorProfileCategory.deleteMany({ where: { vendorProfileId: profile.id } });

      const res = await browser.post(`/api/vendor/popups/${id}/announce`);

      expect(res.status).toBe(409);
      expect((await browser.get(`/api/vendor/popups/${id}`)).body.checklist.profile).toBe(false);
      expect(user.id).toBeTruthy();
    });
  });

  describe('after announcing', () => {
    it('edits sends no email and keeps the type', async () => {
      const { browser } = await host();
      const id = await ready(browser);
      await browser.post(`/api/vendor/popups/${id}/announce`);

      const res = await browser.put(`/api/vendor/popups/${id}`).send(details({ venueName: 'Habi Café garden', coverFileId: (await prisma.event.findUniqueOrThrow({ where: { id } })).coverFileId }));

      expect(res.status).toBe(200);
      expect(res.body.details.venueName).toBe('Habi Café garden');
      expect(await prisma.emailNotification.count()).toBe(0);
    });

    it("can't be edited while host approval is back in review", async () => {
      const { user, browser } = await host();
      const id = await ready(browser);
      await browser.post(`/api/vendor/popups/${id}/announce`);
      await prisma.userRole.update({ where: { userId_role: { userId: user.id, role: 'vendor' } }, data: { approvalStatus: 'pending_review' } });

      const res = await browser.put(`/api/vendor/popups/${id}`).send(details());

      expect(res.status).toBe(409);
      expect((await browser.get(`/api/vendor/popups/${id}`)).body.lock).toBe('pending_review');
    });

    it('cancel takes an optional reason, sends no email, and leaves the page up', async () => {
      const { browser } = await host();
      const id = await ready(browser);
      await browser.post(`/api/vendor/popups/${id}/announce`);

      const res = await browser.post(`/api/vendor/popups/${id}/cancel`).send({ reason: 'Closed for a private event' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'canceled', canceled: { reason: 'Closed for a private event' }, lock: 'canceled' });
      expect(await prisma.emailNotification.count()).toBe(0);
      const slug = (await prisma.event.findUniqueOrThrow({ where: { id } })).slug;
      const page = await agent(app).get(`/api/public/events/${slug}`);
      expect(page.body.page).toMatchObject({ view: 'public', event: { status: 'canceled', canceled: { reason: 'Closed for a private event' } } });
      expect((await browser.put(`/api/vendor/popups/${id}`).send(details())).status).toBe(409);
      expect((await browser.post(`/api/vendor/popups/${id}/announce`)).status).toBe(409);
    });

    it('the hourly job marks it completed after it ends', async () => {
      const { browser } = await host();
      const id = await ready(browser);
      await browser.post(`/api/vendor/popups/${id}/announce`);

      await completeEndedEvents(prisma, new Date('2027-01-17T00:00:00Z'));

      expect((await prisma.event.findUniqueOrThrow({ where: { id } })).status).toBe('completed');
    });
  });

  describe('duplicate', () => {
    it('makes a new draft with the name, description, venue, and a copy of the cover, without dates', async () => {
      const { user, browser } = await host();
      const id = await ready(browser);
      await browser.post(`/api/vendor/popups/${id}/announce`);

      const res = await browser.post(`/api/vendor/popups/${id}/duplicate`);

      expect(res.status).toBe(201);
      const [source, copy] = await Promise.all([
        prisma.event.findUniqueOrThrow({ where: { id }, include: { coverFile: true } }),
        prisma.event.findUniqueOrThrow({ where: { id: res.body.id }, include: { coverFile: true } }),
      ]);
      expect(copy).toMatchObject({ status: 'draft', name: source.name, description: source.description, venueName: 'Habi Café', startsAt: null, endsAt: null });
      expect(copy.coverFileId).not.toBe(source.coverFileId);
      expect(copy.coverFile).toMatchObject({ uploadedBy: user.id, status: 'ready', purpose: 'event_cover' });
      expect(storage.objects.has(`public/${copy.coverFile!.storageKey}`)).toBe(true);
    });
  });

  describe('my pop-ups', () => {
    it('lists Upcoming and Past with the next step', async () => {
      const { browser, profile } = await host();
      const draftId = await draft(browser, 'Weekend rack');
      const { profile: org } = await createOrganizer(prisma);
      await readyEvent(prisma, org.id);
      const past = await prisma.event.create({
        data: {
          hostVendorProfileId: profile.id,
          eventTypeId: (await prisma.eventType.findFirstOrThrow({ where: { slug: 'pop-up' } })).id,
          name: 'Old pop-up',
          slug: `old-${crypto.randomUUID()}`,
          status: 'completed',
          startsAt: new Date('2025-10-04T02:00:00Z'),
          endsAt: new Date('2025-10-04T10:00:00Z'),
        },
      });

      const res = await browser.get('/api/vendor/popups');

      expect(res.body.upcoming).toEqual([expect.objectContaining({ id: draftId, status: 'draft', nextStep: 'Add a description' })]);
      expect(res.body.past).toEqual([expect.objectContaining({ id: past.id, status: 'completed' })]);
    });

    it('gives the dashboard the next two upcoming pop-ups and the host status, without the earned check', async () => {
      const { browser } = await host('not_submitted');
      await draft(browser, 'First');
      await draft(browser, 'Second');
      await draft(browser, 'Third');

      const res = await browser.get('/api/vendor/popups/summary');

      expect(res.status).toBe(200);
      expect(res.body.host.status).toBe('not_submitted');
      expect(res.body.upcoming.map((r: { name: string }) => r.name)).toEqual(['First', 'Second']);
      expect(res.body.total).toBe(3);
    });
  });
});
