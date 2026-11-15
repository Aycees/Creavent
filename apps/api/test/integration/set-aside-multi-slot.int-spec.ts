import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, signInAs } from './app.js';
import { assignedSlot, eventParts, readyFile, submittedApplication } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// Set-aside slots and several slots per vendor (decisions P1 to P6).
describe('set-aside slots and several slots per vendor', () => {
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

  // An open event (A-01 ₱800, A-02 ₱800, B-01 ₱1,500) allowing 2 slots per
  // vendor, with an organizer and a vendor signed in.
  async function setup(slotMode: 'vendor_preference' | 'organizer_assigns' = 'vendor_preference') {
    const organizer = await createOrganizer(prisma);
    const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', slotMode });
    await prisma.event.update({ where: { id: eventId }, data: { maxSlotsPerVendor: 2 } });
    const parts = await eventParts(prisma, eventId);
    const vendor = await createVendor(prisma, [parts.preloved.id]);
    return {
      organizer,
      eventId,
      ...parts,
      vendor,
      org: await signInAs(app, organizer.user.email),
      ven: await signInAs(app, vendor.user.email),
    };
  }
  type Setup = Awaited<ReturnType<typeof setup>>;

  const setAside = (s: Setup, slotId: string, body: { setAside: boolean; note?: string | null }) =>
    s.org.put(`/api/organizer/events/${s.eventId}/slots/${slotId}/set-aside`).send(body);

  async function apply(s: Setup, body: Record<string, unknown>) {
    const clearance = await readyFile(prisma, s.vendor.user.id);
    return s.ven.post(`/api/vendor/events/${s.event.slug}/applications`).send({
      categoryIds: [s.preloved.id],
      documents: [{ requirementId: s.clearance.id, fileIds: [clearance.id] }],
      ...body,
    });
  }

  async function approved(s: Setup, slotsRequested: number, preferredSlotIds: string[] = []) {
    const a = await submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: s.vendor.profile.id, categoryId: s.preloved.id, slotsRequested, preferredSlotIds });
    await prisma.application.update({ where: { id: a.id }, data: { status: 'approved' } });
    return a;
  }

  const assign = (s: Setup, applicationId: string, slotIds: string[]) =>
    s.org.post(`/api/organizer/events/${s.eventId}/assignments`).send({ applicationId, slotIds });

  describe('setting a slot aside', () => {
    it('keeps the slot with a private note, and shows it as set aside, not open', async () => {
      const s = await setup();

      const res = await setAside(s, s.slots[0].id, { setAside: true, note: 'Sponsor booth' });

      expect(res.status).toBe(200);
      expect(res.body.slots.list[0]).toMatchObject({ label: 'A-01', setAside: { note: 'Sponsor booth' } });
      expect(res.body.slots.list[1].setAside).toBeNull();
      expect(await prisma.auditLog.count({ where: { entityId: s.slots[0].id, action: 'slot.set_aside' } })).toBe(1);
      const vendors = await s.org.get(`/api/organizer/events/${s.eventId}/vendors`);
      expect(vendors.body.glance).toMatchObject({ open: 2, setAside: 1 });
      expect(vendors.body.slots[0]).toMatchObject({ label: 'A-01', state: 'set_aside', setAsideNote: 'Sponsor booth' });
    });

    it('shows the slot as taken to vendors, who cannot prefer it', async () => {
      const s = await setup();
      await setAside(s, s.slots[0].id, { setAside: true });

      const form = await s.ven.get(`/api/vendor/events/${s.event.slug}/apply`);
      expect(form.body.slotGroups[0].slots[0]).toMatchObject({ label: 'A-01', taken: true });
      const res = await apply(s, { preferredSlotIds: [s.slots[0].id] });
      expect(res.status).toBe(400);
    });

    it('cannot be assigned while set aside, and opens again when undone', async () => {
      const s = await setup();
      const a = await approved(s, 1);
      await setAside(s, s.slots[0].id, { setAside: true, note: 'Our booth' });

      const refused = await assign(s, a.id, [s.slots[0].id]);
      expect(refused.status).toBe(409);
      expect(refused.body.message).toBe('A-01 is set aside. Open it again on the Slots tab first.');

      const undone = await setAside(s, s.slots[0].id, { setAside: false });
      expect(undone.body.slots.list[0].setAside).toBeNull();
      expect((await assign(s, a.id, [s.slots[0].id])).status).toBe(201);
    });

    it('refuses a slot with a vendor, and a slot of another organizer', async () => {
      const s = await setup();
      await assignedSlot(prisma, { eventId: s.eventId, vendorProfileId: s.vendor.profile.id, categoryId: s.preloved.id, slotId: s.slots[0].id, organizerUserId: s.organizer.user.id });

      const res = await setAside(s, s.slots[0].id, { setAside: true });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('A-01 has a vendor. Remove the vendor from it first.');

      const stranger = await createOrganizer(prisma);
      const browser = await signInAs(app, stranger.user.email);
      expect((await browser.put(`/api/organizer/events/${s.eventId}/slots/${s.slots[1].id}/set-aside`).send({ setAside: true })).status).toBe(404);
    });
  });

  describe('slots per vendor', () => {
    it('saves the limit on the Slots tab and shows it on the apply form', async () => {
      const s = await setup();

      const res = await s.org.put(`/api/organizer/events/${s.eventId}/slot-settings`).send({ mode: 'vendor_preference', defaultPrice: 800, vendorFloorPlanFileId: null, maxSlotsPerVendor: 3 });

      expect(res.status).toBe(200);
      expect(res.body.slots.maxSlotsPerVendor).toBe(3);
      expect((await s.ven.get(`/api/vendor/events/${s.event.slug}/apply`)).body.event.maxSlotsPerVendor).toBe(3);
      const tooMany = await s.org.put(`/api/organizer/events/${s.eventId}/slot-settings`).send({ mode: 'vendor_preference', defaultPrice: 800, vendorFloorPlanFileId: null, maxSlotsPerVendor: 11 });
      expect(tooMany.status).toBe(400);
    });
  });

  describe('applying for several slots', () => {
    it('saves how many slots the vendor needs and their preferred slots', async () => {
      const s = await setup();

      const res = await apply(s, { slotsRequested: 2, preferredSlotIds: [s.slots[0].id, s.slots[1].id] });

      expect(res.status).toBe(201);
      const application = await prisma.application.findUniqueOrThrow({ where: { id: res.body.id }, include: { preferredSlots: true } });
      expect(application.slotsRequested).toBe(2);
      expect(application.preferredSlots.map((p) => p.slotId).sort()).toEqual([s.slots[0].id, s.slots[1].id].sort());
      const detail = await s.ven.get(`/api/vendor/applications/${res.body.id}`);
      expect(detail.body).toMatchObject({ slotsRequested: 2, preferredSlots: [{ label: 'A-01' }, { label: 'A-02' }] });
    });

    it('refuses more slots than the event allows, and more picks than slots asked for', async () => {
      const s = await setup();

      const tooMany = await apply(s, { slotsRequested: 3 });
      expect(tooMany.status).toBe(400);
      expect(tooMany.body.message).toBe('This event allows up to 2 slots per vendor');
      expect((await apply(s, { slotsRequested: 1, preferredSlotIds: [s.slots[0].id, s.slots[1].id] })).status).toBe(400);
    });

    it('keeps the number but not the picks when the organizer assigns slots', async () => {
      const s = await setup('organizer_assigns');

      const res = await apply(s, { slotsRequested: 2, preferredSlotIds: [s.slots[0].id] });

      expect(res.status).toBe(201);
      expect(await prisma.application.findUniqueOrThrow({ where: { id: res.body.id }, include: { preferredSlots: true } })).toMatchObject({ slotsRequested: 2, preferredSlots: [] });
    });

    it('lets the vendor change their picks, up to the number asked for', async () => {
      const s = await setup();
      const a = await approved(s, 2, [s.slots[0].id]);

      const res = await s.ven.put(`/api/vendor/applications/${a.id}/preference`).send({ preferredSlotIds: [s.slots[1].id, s.slots[2].id] });
      expect(res.status).toBe(200);
      expect(res.body.preferredSlots.map((p: { label: string }) => p.label)).toEqual(['A-02', 'B-01']);

      const tooMany = await s.ven.put(`/api/vendor/applications/${a.id}/preference`).send({ preferredSlotIds: s.slots.map((x) => x.id) });
      expect(tooMany.status).toBe(400);
      expect(tooMany.body.message).toBe('Pick at most 2 slots');
    });
  });

  describe('assigning several slots', () => {
    it('assigns them as one: one total, one payment, one email', async () => {
      const s = await setup();
      const a = await approved(s, 2, [s.slots[0].id, s.slots[2].id]);

      const vendors = await s.org.get(`/api/organizer/events/${s.eventId}/vendors`);
      expect(vendors.body.unassigned[0]).toMatchObject({ slotsRequested: 2, preferredSlots: [{ label: 'A-01', state: 'open' }, { label: 'B-01', state: 'open' }] });

      const res = await assign(s, a.id, [s.slots[0].id, s.slots[2].id]);

      expect(res.status).toBe(201);
      const assignments = await prisma.slotAssignment.findMany({ where: { applicationId: a.id }, include: { slots: true, payment: true } });
      expect(assignments).toHaveLength(1);
      const [assignment] = assignments;
      expect(Number(assignment.priceLocked)).toBe(2300);
      expect(Number(assignment.payment!.amountDue)).toBe(2300);
      expect(assignment.slots.map((x) => [x.slotId, Number(x.priceLocked), x.active])).toHaveLength(2);
      expect(assignment.slots.map((x) => [x.slotId, Number(x.priceLocked), x.active])).toEqual(
        expect.arrayContaining([
          [s.slots[0].id, 800, true],
          [s.slots[2].id, 1500, true],
        ]),
      );
      const emails = await prisma.emailNotification.findMany({ where: { type: 'slot_assigned' } });
      expect(emails).toHaveLength(1);
      expect(emails[0].payload).toMatchObject({ slotLabel: 'A-01, B-01', amount: '₱2,300' });
      expect(res.body.glance).toMatchObject({ open: 1, assigned: 2 });
      expect(res.body.assignments[0]).toMatchObject({ slotLabel: 'A-01, B-01', amountDue: 2300 });

      const detail = await s.ven.get(`/api/vendor/applications/${a.id}`);
      expect(detail.body.assignment).toMatchObject({ slotLabel: 'A-01, B-01', amountDue: 2300, slots: [{ label: 'A-01', price: 800 }, { label: 'B-01', price: 1500 }] });
    });

    it('refuses more slots than the vendor asked for, and any slot that is taken', async () => {
      const s = await setup();
      const a = await approved(s, 1);
      const tooMany = await assign(s, a.id, [s.slots[0].id, s.slots[1].id]);
      expect(tooMany.status).toBe(400);
      expect(tooMany.body.message).toBe("Lola's Ukay asked for 1 slot");

      const other = await createVendor(prisma, [s.preloved.id]);
      await assignedSlot(prisma, { eventId: s.eventId, vendorProfileId: other.profile.id, categoryId: s.preloved.id, slotId: s.slots[1].id, organizerUserId: s.organizer.user.id });
      const b = await prisma.application.update({ where: { id: a.id }, data: { slotsRequested: 2 } });
      const taken = await assign(s, b.id, [s.slots[0].id, s.slots[1].id]);
      expect(taken.status).toBe(409);
      expect(await prisma.slotAssignment.count({ where: { applicationId: a.id } })).toBe(0);
    });
  });

  describe('releasing several slots', () => {
    async function withTwo(s: Setup) {
      const r = await assignedSlot(prisma, {
        eventId: s.eventId,
        vendorProfileId: s.vendor.profile.id,
        categoryId: s.preloved.id,
        slotId: s.slots[0].id,
        slotIds: [s.slots[0].id, s.slots[1].id],
        organizerUserId: s.organizer.user.id,
        price: 1600,
      });
      return r;
    }

    it('releases all of them together, and they can be given to someone else', async () => {
      const s = await setup();
      const { application } = await withTwo(s);

      const res = await s.ven.post(`/api/vendor/applications/${application.id}/release`).send({});

      expect(res.status).toBe(201);
      expect(await prisma.slotAssignmentSlot.count({ where: { active: true } })).toBe(0);
      const email = await prisma.emailNotification.findFirstOrThrow({ where: { type: 'slot_released' } });
      expect(email.payload).toMatchObject({ slotLabel: 'A-01, A-02' });
      const vendors = await s.org.get(`/api/organizer/events/${s.eventId}/vendors`);
      expect(vendors.body.glance).toMatchObject({ open: 3, assigned: 0 });

      const other = await createVendor(prisma, [s.preloved.id]);
      const b = await submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: other.profile.id, categoryId: s.preloved.id, slotsRequested: 2 });
      await prisma.application.update({ where: { id: b.id }, data: { status: 'approved' } });
      expect((await assign(s, b.id, [s.slots[0].id, s.slots[1].id])).status).toBe(201);
    });

    it('frees all of them when the organizer removes the vendor', async () => {
      const s = await setup();
      const { application } = await withTwo(s);

      const res = await s.org.post(`/api/organizer/events/${s.eventId}/applications/${application.id}/remove`).send({ canReapply: true });

      expect(res.status).toBe(201);
      expect(res.body.glance).toMatchObject({ open: 3, assigned: 0 });
    });

    it('swaps them for new picks in one step', async () => {
      const s = await setup();
      const { application } = await withTwo(s);

      const res = await s.ven.post(`/api/vendor/applications/${application.id}/change-slot`).send({ preferredSlotIds: [s.slots[2].id] });

      expect(res.status).toBe(201);
      expect(await prisma.slotAssignmentSlot.count({ where: { active: true } })).toBe(0);
      expect(res.body.preferredSlots.map((p: { label: string }) => p.label)).toEqual(['B-01']);
      const email = await prisma.emailNotification.findFirstOrThrow({ where: { type: 'slot_released' } });
      expect(email.payload).toMatchObject({ slotLabel: 'A-01, A-02', newPreference: 'B-01' });
    });
  });
});
