import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { completeEndedEvents } from '../../src/events/complete-events.js';
import { createTestApp, signInAs } from './app.js';
import { assignedSlot, eventParts, submittedApplication } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// Feature 4.1: announce, cancel, change emails, and the completed job (spec
// §3.1, flows 8 and 9, decisions Q3, Q4, Q6 to Q8).
describe('announcing, changing, and canceling an event', () => {
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

  async function setup(status: 'open_to_vendors' | 'announced' = 'open_to_vendors') {
    const organizer = await createOrganizer(prisma);
    const eventId = await readyEvent(prisma, organizer.profile.id, { status });
    const parts = await eventParts(prisma, eventId);
    const browser = await signInAs(app, organizer.user.email);
    return { organizer, eventId, parts, browser };
  }

  async function vendorWithSlot(eventId: string, slotId: string, organizerUserId: string, reserved = false) {
    const parts = await eventParts(prisma, eventId);
    const vendor = await createVendor(prisma, [parts.preloved.id]);
    const slot = await assignedSlot(prisma, { eventId, vendorProfileId: vendor.profile.id, categoryId: parts.preloved.id, slotId, organizerUserId });
    if (reserved) {
      await prisma.slotAssignment.update({ where: { id: slot.assignment.id }, data: { status: 'reserved', reservedAt: new Date() } });
      await prisma.payment.update({ where: { id: slot.payment.id }, data: { status: 'approved' } });
    }
    return { vendor, ...slot };
  }

  describe('announce', () => {
    it('tells the organizer what announcing shows and what is still unpaid', async () => {
      const { organizer, eventId, parts, browser } = await setup();
      await vendorWithSlot(eventId, parts.slots[0]!.id, organizer.user.id, true);
      const unpaid = await vendorWithSlot(eventId, parts.slots[1]!.id, organizer.user.id);
      await prisma.slotAssignment.update({ where: { id: unpaid.assignment.id }, data: { deadlineAt: new Date(Date.now() - 3_600_000) } });

      const res = await browser.get(`/api/organizer/events/${eventId}`);

      expect(res.body.lineup).toEqual({
        confirmedVendors: 1,
        activeVendors: 2,
        unpaid: [{ slotLabel: 'A-02', shopName: "Lola's Ukay", state: 'overdue' }],
      });
      expect(res.body.ended).toBe(false);
      expect(res.body.canceled).toBeNull();
    });

    it('announces an event open to vendors and logs it', async () => {
      const { organizer, eventId, browser } = await setup();

      const res = await browser.post(`/api/organizer/events/${eventId}/announce`).send({});

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'announced', applicationsOpen: true });
      const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
      expect(event.announcedAt).not.toBeNull();
      const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: eventId, action: 'event.announce' } });
      expect(log).toMatchObject({ actorUserId: organizer.user.id, changes: { status: { from: 'open_to_vendors', to: 'announced' } } });
    });

    it('refuses a draft, an announced event, an ended event, and a hidden event', async () => {
      const { organizer, browser } = await setup();
      const draft = await readyEvent(prisma, organizer.profile.id);
      const announced = await readyEvent(prisma, organizer.profile.id, { status: 'announced' });
      const ended = await readyEvent(prisma, organizer.profile.id, {
        status: 'open_to_vendors',
        startsAt: new Date('2026-01-10T09:00:00Z'),
        endsAt: new Date('2026-01-10T15:00:00Z'),
      });
      const hidden = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', moderationState: 'hidden' });

      for (const id of [draft, announced, ended, hidden]) {
        const res = await browser.post(`/api/organizer/events/${id}/announce`).send({});
        expect(res.status).toBe(409);
      }
      expect(await prisma.event.count({ where: { status: 'announced' } })).toBe(1);
    });

    it('refuses an organizer who is no longer approved', async () => {
      const { organizer, eventId, browser } = await setup();
      await prisma.userRole.update({ where: { userId_role: { userId: organizer.user.id, role: 'organizer' } }, data: { approvalStatus: 'pending_review' } });

      const res = await browser.post(`/api/organizer/events/${eventId}/announce`).send({});

      expect(res.status).toBe(403);
    });

    it("refuses another organizer's event", async () => {
      const { eventId } = await setup();
      const other = await createOrganizer(prisma);
      const browser = await signInAs(app, other.user.email);

      const res = await browser.post(`/api/organizer/events/${eventId}/announce`).send({});

      expect(res.status).toBe(404);
    });
  });

  describe('undo announce', () => {
    const announceNow = async (browser: Awaited<ReturnType<typeof setup>>['browser'], eventId: string) =>
      browser.post(`/api/organizer/events/${eventId}/announce`).send({});

    it('offers the undo for 10 minutes after announcing', async () => {
      const { eventId, browser } = await setup();

      const res = await announceNow(browser, eventId);

      const until = new Date(res.body.undoAnnounceUntil).getTime();
      expect(until - Date.now()).toBeGreaterThan(9 * 60_000);
      expect(until - Date.now()).toBeLessThanOrEqual(10 * 60_000);
    });

    it('takes the event back to open to vendors, keeping slots and applications, and logs it', async () => {
      const { organizer, eventId, parts, browser } = await setup();
      const reserved = await vendorWithSlot(eventId, parts.slots[0]!.id, organizer.user.id, true);
      await announceNow(browser, eventId);

      const res = await browser.post(`/api/organizer/events/${eventId}/undo-announce`).send({});

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'open_to_vendors', applicationsOpen: true, undoAnnounceUntil: null });
      expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).announcedAt).toBeNull();
      expect((await prisma.slotAssignment.findUniqueOrThrow({ where: { id: reserved.assignment.id } })).status).toBe('reserved');
      const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: eventId, action: 'event.undo_announce' } });
      expect(log).toMatchObject({ actorUserId: organizer.user.id, changes: { status: { from: 'announced', to: 'open_to_vendors' } } });
      expect(await prisma.emailNotification.count()).toBe(0);
    });

    it('hides it from visitors again, and it can be announced again', async () => {
      const { eventId, browser } = await setup();
      const { slug } = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
      await announceNow(browser, eventId);

      await browser.post(`/api/organizer/events/${eventId}/undo-announce`).send({});
      expect((await request(app.getHttpServer()).get(`/api/public/events/${slug}`)).body.page).toEqual({ view: 'not_public' });

      expect((await announceNow(browser, eventId)).body.status).toBe('announced');
    });

    it('refuses once the 10 minutes have passed, and for an event that is not announced', async () => {
      const { eventId, browser } = await setup();
      await announceNow(browser, eventId);
      await prisma.event.update({ where: { id: eventId }, data: { announcedAt: new Date(Date.now() - 11 * 60_000) } });

      const late = await browser.post(`/api/organizer/events/${eventId}/undo-announce`).send({});

      expect(late.status).toBe(409);
      expect(late.body.message).toBe('You can undo an announcement for 10 minutes. Edit or cancel the event instead.');
      expect((await browser.get(`/api/organizer/events/${eventId}`)).body.undoAnnounceUntil).toBeNull();
      const open = await setup();
      expect((await open.browser.post(`/api/organizer/events/${open.eventId}/undo-announce`).send({})).status).toBe(409);
    });

    it("refuses another organizer's event", async () => {
      const { eventId, browser } = await setup();
      await announceNow(browser, eventId);
      const other = await createOrganizer(prisma);

      expect((await (await signInAs(app, other.user.email)).post(`/api/organizer/events/${eventId}/undo-announce`).send({})).status).toBe(404);
    });
  });

  describe('change emails', () => {
    const details = (overrides: Record<string, unknown> = {}) => ({
      name: 'Lanang Holiday Flea',
      eventTypeId: undefined as string | undefined,
      description: 'Three nights of ukay-ukay and food.',
      startDate: '2027-01-15',
      endDate: '2027-01-17',
      opensAt: '17:00',
      closesAt: '23:00',
      venueName: 'Damosa Gateway',
      addressLine: 'Lanang',
      city: 'Davao City',
      coverFileId: undefined as string | undefined,
      vendorContactInfo: 'Rhea · 0917 482 1093',
      applicationsCloseAt: null,
      ingressInfo: 'From 1 PM, Gate 2',
      ...overrides,
    });

    async function save(browser: Awaited<ReturnType<typeof setup>>['browser'], eventId: string, overrides: Record<string, unknown>) {
      const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
      return browser.put(`/api/organizer/events/${eventId}/details`).send(details({ eventTypeId: event.eventTypeId, coverFileId: event.coverFileId, ...overrides }));
    }

    it('emails active vendors the old and new time when the hours change', async () => {
      const { organizer, eventId, parts, browser } = await setup();
      const withSlot = await vendorWithSlot(eventId, parts.slots[0]!.id, organizer.user.id);
      const applied = await createVendor(prisma, [parts.preloved.id]);
      await submittedApplication(prisma, { eventId, vendorProfileId: applied.profile.id, categoryId: parts.preloved.id });
      const withdrawn = await createVendor(prisma, [parts.preloved.id]);
      const gone = await submittedApplication(prisma, { eventId, vendorProfileId: withdrawn.profile.id, categoryId: parts.preloved.id });
      await prisma.application.update({ where: { id: gone.id }, data: { status: 'withdrawn' } });
      await save(browser, eventId, {}); // the same values: nothing to say
      expect(await prisma.emailNotification.count({ where: { type: 'event_changed' } })).toBe(0);

      const res = await save(browser, eventId, { opensAt: '16:00' });

      expect(res.status).toBe(200);
      const emails = await prisma.emailNotification.findMany({ where: { type: 'event_changed' }, orderBy: { toEmail: 'asc' } });
      const byId = (a: string | null, b: string | null) => (a ?? '').localeCompare(b ?? '');
      expect(emails.map((e) => e.userId).sort(byId)).toEqual([withSlot.vendor.user.id, applied.user.id].sort(byId));
      const mine = emails.find((e) => e.userId === withSlot.vendor.user.id)!;
      expect(mine.payload).toMatchObject({
        eventName: 'Lanang Holiday Flea',
        slotLabel: 'A-01',
        changes: [{ label: 'When', from: 'Fri, Jan 15 to Sun, Jan 17 · 5 PM to 11 PM daily', to: 'Fri, Jan 15 to Sun, Jan 17 · 4 PM to 11 PM daily' }],
      });
      expect(emails.find((e) => e.userId === applied.user.id)!.payload).toMatchObject({ slotLabel: null });
    });

    it('emails a venue change and stays quiet for other fields', async () => {
      const { eventId, parts, browser } = await setup('announced');
      const applied = await createVendor(prisma, [parts.preloved.id]);
      await submittedApplication(prisma, { eventId, vendorProfileId: applied.profile.id, categoryId: parts.preloved.id });

      await save(browser, eventId, { description: 'Now with live music.' });
      expect(await prisma.emailNotification.count({ where: { type: 'event_changed' } })).toBe(0);

      await save(browser, eventId, { venueName: 'Abreeza Mall', addressLine: 'J.P. Laurel Avenue' });
      const email = await prisma.emailNotification.findFirstOrThrow({ where: { type: 'event_changed' } });
      expect(email.payload).toMatchObject({
        changes: [{ label: 'Where', from: 'Damosa Gateway, Lanang, Davao City', to: 'Abreeza Mall, J.P. Laurel Avenue, Davao City' }],
      });
    });

    it('sends nothing for a draft', async () => {
      const { organizer, browser } = await setup();
      const draft = await readyEvent(prisma, organizer.profile.id);

      await save(browser, draft, { opensAt: '16:00' });

      expect(await prisma.emailNotification.count({ where: { type: 'event_changed' } })).toBe(0);
    });
  });

  describe('cancel', () => {
    it('cancels, ends active slots, archives payments, and emails active vendors with the reason', async () => {
      const { organizer, eventId, parts, browser } = await setup('announced');
      const reserved = await vendorWithSlot(eventId, parts.slots[0]!.id, organizer.user.id, true);
      const assigned = await vendorWithSlot(eventId, parts.slots[1]!.id, organizer.user.id);
      const declined = await createVendor(prisma, [parts.preloved.id]);
      const no = await submittedApplication(prisma, { eventId, vendorProfileId: declined.profile.id, categoryId: parts.preloved.id });
      await prisma.application.update({ where: { id: no.id }, data: { status: 'declined' } });

      const res = await browser.post(`/api/organizer/events/${eventId}/cancel`).send({ reason: 'Typhoon signal 2 over Davao.' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'canceled', canceled: { reason: 'Typhoon signal 2 over Davao.' } });
      const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
      expect(event).toMatchObject({ status: 'canceled', cancelReason: 'Typhoon signal 2 over Davao.' });
      expect(event.canceledAt).not.toBeNull();
      const assignments = await prisma.slotAssignment.findMany({ where: { eventId } });
      expect(assignments.map((a) => a.status)).toEqual(['canceled', 'canceled']);
      expect(await prisma.slotAssignmentSlot.count({ where: { active: true } })).toBe(0);
      const payments = await prisma.payment.findMany({ where: { eventId } });
      expect(payments.every((p) => p.archivedAt !== null)).toBe(true);
      expect((await prisma.application.findMany({ where: { eventId } })).map((a) => a.status).sort((a, b) => a.localeCompare(b))).toEqual(['approved', 'approved', 'declined']);
      const emails = await prisma.emailNotification.findMany({ where: { type: 'event_canceled' } });
      const byId = (a: string | null, b: string | null) => (a ?? '').localeCompare(b ?? '');
      expect(emails.map((e) => e.userId).sort(byId)).toEqual([reserved.vendor.user.id, assigned.vendor.user.id].sort(byId));
      expect(emails[0]!.payload).toMatchObject({ reason: 'Typhoon signal 2 over Davao.', organizerName: 'Balik-Gamit Davao', organizerContact: 'Rhea · 0917 482 1093' });
      expect(await prisma.auditLog.count({ where: { entityId: eventId, action: 'event.cancel' } })).toBe(1);
    });

    it("shows the vendor's application as Event canceled, not as approved without a slot", async () => {
      const { organizer, eventId, parts, browser } = await setup('announced');
      const withSlot = await vendorWithSlot(eventId, parts.slots[0]!.id, organizer.user.id);
      await browser.post(`/api/organizer/events/${eventId}/cancel`).send({});
      const vendor = await signInAs(app, withSlot.vendor.user.email);

      const detail = await vendor.get(`/api/vendor/applications/${withSlot.application.id}`);
      const list = await vendor.get('/api/vendor/applications');

      expect(detail.body.status).toBe('event_canceled');
      expect(list.body.applications[0].status).toBe('event_canceled');
    });

    it('cancels without a reason, from open to vendors', async () => {
      const { eventId, browser } = await setup();

      const res = await browser.post(`/api/organizer/events/${eventId}/cancel`).send({});

      expect(res.status).toBe(201);
      expect(res.body.canceled).toMatchObject({ reason: null });
    });

    it('refuses a draft, a completed event, and a canceled one', async () => {
      const { organizer, browser } = await setup();
      const draft = await readyEvent(prisma, organizer.profile.id);
      const completed = await readyEvent(prisma, organizer.profile.id, { status: 'completed' });
      const canceled = await readyEvent(prisma, organizer.profile.id, { status: 'canceled' });

      for (const id of [draft, completed, canceled]) {
        expect((await browser.post(`/api/organizer/events/${id}/cancel`).send({})).status).toBe(409);
      }
    });

    it('refuses changes to a canceled event', async () => {
      const { eventId, browser } = await setup();
      await browser.post(`/api/organizer/events/${eventId}/cancel`).send({});

      const res = await browser.put(`/api/organizer/events/${eventId}/policy`).send({ text: 'New policy.' });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('This event is canceled');
    });
  });

  describe('the completed job', () => {
    it('marks announced events that have ended as completed, and leaves the rest', async () => {
      const { organizer } = await setup();
      const past = { startsAt: new Date('2026-11-14T09:00:00Z'), endsAt: new Date('2026-11-14T15:00:00Z') };
      const ended = await readyEvent(prisma, organizer.profile.id, { status: 'announced', ...past });
      const neverAnnounced = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', ...past });
      const running = await readyEvent(prisma, organizer.profile.id, {
        status: 'announced',
        startsAt: new Date('2026-11-14T09:00:00Z'),
        endsAt: new Date('2026-11-16T15:00:00Z'),
      });

      const changed = await completeEndedEvents(prisma, new Date('2026-11-15T00:00:00Z'));

      expect(changed).toEqual(['listing', `event:${ended}`]);
      const statuses = await prisma.event.findMany({ where: { id: { in: [ended, neverAnnounced, running] } }, select: { id: true, status: true, completedAt: true } });
      expect(statuses.find((e) => e.id === ended)).toMatchObject({ status: 'completed', completedAt: new Date('2026-11-15T00:00:00Z') });
      expect(statuses.find((e) => e.id === neverAnnounced)!.status).toBe('open_to_vendors');
      expect(statuses.find((e) => e.id === running)!.status).toBe('announced');
    });
  });
});
