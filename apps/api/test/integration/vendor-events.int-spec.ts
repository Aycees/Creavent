import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { agent, createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { readyEvent } from './events.js';
import { createOrganizer, createUser, createVendor } from './factories.js';
import { submittedApplication } from './applications.js';

// Feature 2.6: vendor browsing and the vendor view of the event page
// (spec §4.2, sitemap §3, flow 4).
describe('vendor browsing and the event page', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let preloved: string;
  let plants: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    preloved = (await prisma.category.findFirstOrThrow({ where: { slug: 'preloved-clothing' } })).id;
    plants = (await prisma.category.findFirstOrThrow({ where: { slug: 'plants' } })).id;
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

  async function vendor() {
    const { user } = await createVendor(prisma, [preloved, plants]);
    return signInAs(app, user.email);
  }

  // An event n days from today (Manila), 9 AM to 5 PM, so it shows in Browse
  // events when n is 0 or more.
  const manilaDate = (n: number) => new Date(Date.now() + 8 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
  const future = (start: number, length = 0) => ({
    startsAt: new Date(`${manilaDate(start)}T09:00:00+08:00`),
    endsAt: new Date(`${manilaDate(start + length)}T17:00:00+08:00`),
  });

  async function slugOf(id: string) {
    return (await prisma.event.findUniqueOrThrow({ where: { id } })).slug;
  }

  describe('GET /api/vendor/events', () => {
    it('lists visible events open to vendors or announced, soonest first', async () => {
      const { profile } = await createOrganizer(prisma);
      await readyEvent(prisma, profile.id, { status: 'open_to_vendors', name: 'Later market', ...future(20) });
      await readyEvent(prisma, profile.id, { status: 'announced', name: 'Sooner market', ...future(5) });
      await readyEvent(prisma, profile.id, { status: 'draft', name: 'Draft market', ...future(3) });
      await readyEvent(prisma, profile.id, { status: 'open_to_vendors', name: 'Hidden market', moderationState: 'hidden', ...future(4) });
      await readyEvent(prisma, profile.id, { status: 'open_to_vendors', name: 'Past market', ...future(-10) });
      const browser = await vendor();

      const res = await browser.get('/api/vendor/events');

      expect(res.status).toBe(200);
      expect(res.body.events.map((e: { name: string }) => e.name)).toEqual(['Sooner market', 'Later market']);
    });

    it("shows the fee range, the organizer badge, and spots left in the vendor's categories", async () => {
      const { profile } = await createOrganizer(prisma, { displayName: 'Balik-Gamit Davao' });
      await readyEvent(prisma, profile.id, { status: 'open_to_vendors', slotMode: 'vendor_preference', ...future(5) });
      const browser = await vendor();

      const [event] = (await browser.get('/api/vendor/events')).body.events;

      expect(event).toMatchObject({
        status: 'open_to_vendors',
        typeName: 'Flea market',
        organizer: { displayName: 'Balik-Gamit Davao', approved: true },
        feeRange: '₱800 to ₱1,500',
        acceptingApplications: true,
        preferredSlots: true,
        mySpots: [{ categoryName: 'Preloved clothing', left: 12, max: 12 }],
      });
    });

    it('searches by name or venue, and filters by city and the next 30 days', async () => {
      const { profile } = await createOrganizer(prisma);
      await readyEvent(prisma, profile.id, { status: 'open_to_vendors', name: 'Matina Night Flea', ...future(5) });
      await readyEvent(prisma, profile.id, { status: 'open_to_vendors', name: 'Bajada Christmas Flea', ...future(45) });
      const browser = await vendor();

      const byName = (await browser.get('/api/vendor/events?q=matina')).body.events;
      const byVenue = (await browser.get('/api/vendor/events?q=damosa')).body.events;
      const soon = (await browser.get('/api/vendor/events?when=30d')).body.events;
      const elsewhere = (await browser.get('/api/vendor/events?city=Cebu%20City')).body.events;

      expect(byName.map((e: { name: string }) => e.name)).toEqual(['Matina Night Flea']);
      expect(byVenue).toHaveLength(2);
      expect(soon.map((e: { name: string }) => e.name)).toEqual(['Matina Night Flea']);
      expect(elsewhere).toHaveLength(0);
    });

    it("subtracts approved vendors from spots left, and shows the vendor's own status", async () => {
      const { profile } = await createOrganizer(prisma);
      const id = await readyEvent(prisma, profile.id, { status: 'open_to_vendors', ...future(5) });
      const others = await Promise.all([createVendor(prisma, [preloved]), createVendor(prisma, [preloved])]);
      for (const other of others) {
        const app = await submittedApplication(prisma, { eventId: id, vendorProfileId: other.profile.id, categoryId: preloved });
        await prisma.application.update({ where: { id: app.id }, data: { status: 'approved' } });
      }
      const me = await createVendor(prisma, [preloved, plants]);
      const mine = await submittedApplication(prisma, { eventId: id, vendorProfileId: me.profile.id, categoryId: preloved });
      const browser = await signInAs(app, me.user.email);

      const [card] = (await browser.get('/api/vendor/events')).body.events;
      const page = (await browser.get(`/api/events/${await slugOf(id)}`)).body.event;

      expect(card.mySpots).toEqual([{ categoryName: 'Preloved clothing', left: 10, max: 12 }]);
      expect(card.myStatus).toBe('submitted');
      expect(page.categories[0]).toMatchObject({ name: 'Preloved clothing', left: 10 });
      expect(page.myApplication).toEqual({ id: mine.id, status: 'submitted' });
    });

    it('needs the vendor role', async () => {
      const { user } = await createOrganizer(prisma);
      const browser = await signInAs(app, user.email);

      expect((await browser.get('/api/vendor/events')).status).toBe(403);
    });
  });

  describe('GET /api/events/:slug', () => {
    it('shows a vendor the requirements, slots by section, policy, summary, and contact', async () => {
      const { profile } = await createOrganizer(prisma, { displayName: 'Balik-Gamit Davao' });
      const id = await readyEvent(prisma, profile.id, { status: 'open_to_vendors', applicationsCloseAt: new Date('2027-01-07T15:59:00Z') });
      const browser = await vendor();

      const res = await browser.get(`/api/events/${await slugOf(id)}`);

      expect(res.status).toBe(200);
      expect(res.body.view).toBe('vendor');
      const e = res.body.event;
      expect(e).toMatchObject({
        name: expect.stringContaining('Lanang Holiday Flea'),
        status: 'open_to_vendors',
        startDate: '2027-01-15',
        endDate: '2027-01-17',
        opensAt: '17:00',
        closesAt: '23:00',
        venueName: 'Damosa Gateway',
        applicationsCloseAt: '2027-01-07T23:59',
        acceptingApplications: true,
        organizer: { displayName: 'Balik-Gamit Davao', approved: true },
        policy: 'Pay within 24 hours.',
        vendorContactInfo: 'Rhea · 0917 482 1093',
        summary: { feeRange: '₱800 to ₱1,500', deadlineHours: 24, paidTo: 'GCash' },
        myCategoryIds: [preloved, plants],
      });
      expect(e.categories).toEqual([
        { id: preloved, name: 'Preloved clothing', max: 12, left: 12 },
        { id: expect.any(String), name: 'Food and drinks', max: null, left: null },
      ]);
      expect(e.documents).toEqual([
        { name: 'Barangay business clearance', categoryName: null },
        { name: 'Sanitary permit', categoryName: 'Food and drinks' },
      ]);
      expect(e.slotGroups).toEqual([
        { name: 'Main walkway', range: 'A-01 to A-02', sizes: '2 × 2 m', notes: null, feeRange: '₱800', open: 2, total: 2 },
        { name: 'Entrance', range: 'B-01', sizes: '3 × 3 m', notes: 'Near the gate', feeRange: '₱1,500', open: 1, total: 1 },
      ]);
      expect(e).not.toHaveProperty('ingressInfo');
    });

    it('says applications are closed when the organizer closed them or the date passed', async () => {
      const { profile } = await createOrganizer(prisma);
      const closed = await readyEvent(prisma, profile.id, { status: 'open_to_vendors', applicationsOpen: false });
      const passed = await readyEvent(prisma, profile.id, { status: 'open_to_vendors', applicationsCloseAt: new Date(Date.now() - 60_000) });
      const browser = await vendor();

      expect((await browser.get(`/api/events/${await slugOf(closed)}`)).body.event.acceptingApplications).toBe(false);
      expect((await browser.get(`/api/events/${await slugOf(passed)}`)).body.event.acceptingApplications).toBe(false);
    });

    it('is not found to vendors while it is a draft or hidden', async () => {
      const { profile } = await createOrganizer(prisma);
      const draft = await readyEvent(prisma, profile.id);
      const hidden = await readyEvent(prisma, profile.id, { status: 'open_to_vendors', moderationState: 'hidden' });
      const browser = await vendor();

      expect((await browser.get(`/api/events/${await slugOf(draft)}`)).status).toBe(404);
      expect((await browser.get(`/api/events/${await slugOf(hidden)}`)).status).toBe(404);
      expect((await browser.get('/api/events/no-such-event')).status).toBe(404);
    });

    it("tells a signed-out visitor an open event isn't public yet, and hides a draft", async () => {
      const { profile } = await createOrganizer(prisma);
      const open = await readyEvent(prisma, profile.id, { status: 'open_to_vendors' });
      const draft = await readyEvent(prisma, profile.id);

      const res = await agent(app).get(`/api/events/${await slugOf(open)}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ view: 'not_public' });
      expect((await agent(app).get(`/api/events/${await slugOf(draft)}`)).status).toBe(404);
    });

    it('shows its organizer the vendor view at any status, as a preview', async () => {
      const { user, profile } = await createOrganizer(prisma);
      const draft = await readyEvent(prisma, profile.id);
      const browser = await signInAs(app, user.email);

      const res = await browser.get(`/api/events/${await slugOf(draft)}`);

      expect(res.body).toMatchObject({ view: 'vendor', preview: true, event: { status: 'draft' } });
    });

    it('shows an admin the vendor view', async () => {
      const { profile } = await createOrganizer(prisma);
      const draft = await readyEvent(prisma, profile.id);
      const admin = await createUser(prisma, { isAdmin: true });

      const res = await (await signInAs(app, admin.email)).get(`/api/events/${await slugOf(draft)}`);

      expect(res.body.view).toBe('vendor');
    });
  });
});
