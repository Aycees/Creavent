import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { agent, createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer } from './factories.js';
import { readyEvent } from './events.js';

type Browser = ReturnType<typeof agent>;

// Feature 2.5: the "Open to vendors" checklist and status change (spec §3.1,
// flow 3).
describe('opening an event to vendors', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let fleaMarket: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    fleaMarket = (await prisma.eventType.findFirstOrThrow({ where: { slug: 'flea-market' } })).id;
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

  async function organizer(approvalStatus: 'approved' | 'pending_review' = 'approved') {
    const { user, profile } = await createOrganizer(prisma, { approvalStatus });
    return { user, profile, browser: await signInAs(app, user.email) };
  }

  const open = (browser: Browser, id: string) => browser.post(`/api/organizer/events/${id}/open`).send({});

  it('counts the five required steps on a new draft', async () => {
    const { browser } = await organizer();
    const id = (await browser.post('/api/organizer/events').send({ name: 'Matina Night Flea', eventTypeId: fleaMarket })).body.id;

    const res = await browser.get(`/api/organizer/events/${id}`);

    expect(res.body.checklist).toEqual({ details: false, requirements: false, policy: false, slots: false, payments: false });
    expect(res.body.organizerApproved).toBe(true);
  });

  it('marks each step done as it is filled', async () => {
    const { profile, browser } = await organizer();
    const id = await readyEvent(prisma, profile.id);

    const res = await browser.get(`/api/organizer/events/${id}`);

    expect(res.body.checklist).toEqual({ details: true, requirements: true, policy: true, slots: true, payments: true });
  });

  it('opens a ready event to vendors, opens applications, and logs it', async () => {
    const { user, profile, browser } = await organizer();
    const id = await readyEvent(prisma, profile.id);

    const res = await open(browser, id);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'open_to_vendors', applicationsOpen: true });
    const event = await prisma.event.findUniqueOrThrow({ where: { id } });
    expect(event.openedToVendorsAt).not.toBeNull();
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: id } });
    expect(log).toMatchObject({ actorUserId: user.id, action: 'event.open_to_vendors', changes: { status: { from: 'draft', to: 'open_to_vendors' } } });
  });

  it('refuses an event with a required step missing', async () => {
    const { profile, browser } = await organizer();
    const id = await readyEvent(prisma, profile.id);
    await prisma.eventPaymentMethod.updateMany({ where: { eventId: id }, data: { isActive: false } });

    const res = await open(browser, id);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Finish the required steps first: payment instructions');
  });

  it('needs an approved organizer', async () => {
    const { profile, browser } = await organizer('pending_review');
    const id = await readyEvent(prisma, profile.id);

    const res = await open(browser, id);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Get approved to open this event to vendors');
    expect((await browser.get(`/api/organizer/events/${id}`)).body.organizerApproved).toBe(false);
  });

  it('refuses to open an event twice', async () => {
    const { profile, browser } = await organizer();
    const id = await readyEvent(prisma, profile.id);
    await open(browser, id);

    expect((await open(browser, id)).status).toBe(409);
  });

  it("is not found for another organizer's event", async () => {
    const owner = await organizer();
    const id = await readyEvent(prisma, owner.profile.id);
    const other = await organizer();

    expect((await open(other.browser, id)).status).toBe(404);
  });

  describe('applications', () => {
    it('closes and reopens applications on an open event', async () => {
      const { profile, browser } = await organizer();
      const id = await readyEvent(prisma, profile.id);
      await open(browser, id);

      const closed = await browser.put(`/api/organizer/events/${id}/applications`).send({ open: false });
      const reopened = await browser.put(`/api/organizer/events/${id}/applications`).send({ open: true });

      expect(closed.body.applicationsOpen).toBe(false);
      expect(reopened.body.applicationsOpen).toBe(true);
      expect(await prisma.auditLog.count({ where: { entityId: id, action: { startsWith: 'event.applications' } } })).toBe(2);
    });

    it('refuses on a draft', async () => {
      const { profile, browser } = await organizer();
      const id = await readyEvent(prisma, profile.id);

      expect((await browser.put(`/api/organizer/events/${id}/applications`).send({ open: true })).status).toBe(409);
    });
  });

  describe('editing an open event', () => {
    it.each([
      ['removing the last payment option', (b: Browser, id: string) => b.put(`/api/organizer/events/${id}/payments`).send({ deadlineHours: 24, methods: [] })],
      ['removing every category', (b: Browser, id: string) => b.put(`/api/organizer/events/${id}/requirements`).send({ categories: [], documents: [] })],
    ])('refuses %s', async (_name, save) => {
      const { profile, browser } = await organizer();
      const id = await readyEvent(prisma, profile.id);
      await open(browser, id);

      const res = await save(browser, id);

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/^This event is open to vendors, so it needs/);
    });

    it('refuses removing the last slot', async () => {
      const { profile, browser } = await organizer();
      const id = await readyEvent(prisma, profile.id);
      await open(browser, id);
      const slots = await prisma.slot.findMany({ where: { eventId: id } });
      for (const slot of slots.slice(1)) await browser.delete(`/api/organizer/events/${id}/slots/${slot.id}`);

      const res = await browser.delete(`/api/organizer/events/${id}/slots/${slots[0].id}`);

      expect(res.status).toBe(409);
    });

    it('refuses clearing the venue, and keeps other edits working', async () => {
      const { profile, browser } = await organizer();
      const id = await readyEvent(prisma, profile.id);
      await open(browser, id);
      const setup = (await browser.get(`/api/organizer/events/${id}`)).body;
      const details = { ...setup.details, coverFileId: setup.details.cover.id };
      delete details.cover;

      const cleared = await browser.put(`/api/organizer/events/${id}/details`).send({ ...details, venueName: '' });
      const renamed = await browser.put(`/api/organizer/events/${id}/details`).send({ ...details, name: 'Matina Night Flea, February' });

      expect(cleared.status).toBe(409);
      expect(renamed.status).toBe(200);
    });
  });
});
