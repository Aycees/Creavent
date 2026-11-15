import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, signInAs } from './app.js';
import { assignedSlot, eventParts, submittedApplication } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// The vendor's change of plans (decided 2026-11-15): withdraw while applied or
// approved, change the preferred slot before a slot is assigned, and with an
// unpaid slot release it, pick another, or withdraw.
describe("the vendor's change of plans", () => {
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

  async function setup(slotMode: 'vendor_preference' | 'organizer_assigns' = 'vendor_preference') {
    const organizer = await createOrganizer(prisma);
    const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', slotMode });
    const parts = await eventParts(prisma, eventId);
    const vendor = await createVendor(prisma, [parts.preloved.id]);
    return { organizer, eventId, ...parts, vendor, browser: await signInAs(app, vendor.user.email) };
  }
  type Setup = Awaited<ReturnType<typeof setup>>;

  const approved = async (s: Setup, preferredSlotId: string | null = null) => {
    const a = await submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: s.vendor.profile.id, categoryId: s.preloved.id, preferredSlotId });
    await prisma.application.update({ where: { id: a.id }, data: { status: 'approved' } });
    return a;
  };
  const withSlot = (s: Setup) =>
    assignedSlot(prisma, { eventId: s.eventId, vendorProfileId: s.vendor.profile.id, categoryId: s.preloved.id, slotId: s.slots[0].id, organizerUserId: s.organizer.user.id });

  describe('withdrawing', () => {
    it('withdraws an approved application with no slot, and emails the organizer', async () => {
      const s = await setup();
      const a = await approved(s);

      const res = await s.browser.post(`/api/vendor/applications/${a.id}/withdraw`).send({});

      expect(res.status).toBe(201);
      expect((await prisma.application.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('withdrawn');
      expect(await prisma.emailNotification.count({ where: { type: 'application_withdrawn' } })).toBe(1);
    });

    it('releases an unpaid slot when withdrawing, and archives its payment', async () => {
      const s = await setup();
      const { application, assignment, payment } = await withSlot(s);

      expect((await s.browser.post(`/api/vendor/applications/${application.id}/withdraw`).send({})).status).toBe(201);

      expect((await prisma.slotAssignment.findUniqueOrThrow({ where: { id: assignment.id } })).status).toBe('released');
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).archivedAt).not.toBeNull();
      expect((await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).status).toBe('withdrawn');
    });

    it('refuses once the payment is approved', async () => {
      const s = await setup();
      const { application, assignment } = await withSlot(s);
      await prisma.slotAssignment.update({ where: { id: assignment.id }, data: { status: 'reserved' } });

      const res = await s.browser.post(`/api/vendor/applications/${application.id}/withdraw`).send({});

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Your payment is approved, so contact the organizer to cancel');
    });
  });

  describe('changing the preferred slot', () => {
    it('changes or clears the preference before a slot is assigned', async () => {
      const s = await setup();
      const a = await approved(s, s.slots[0].id);

      const changed = await s.browser.put(`/api/vendor/applications/${a.id}/preference`).send({ preferredSlotIds: [s.slots[2].id] });
      expect(changed.status).toBe(200);
      expect(changed.body.preferredSlots).toMatchObject([{ label: 'B-01', state: 'open' }]);
      expect(await prisma.auditLog.count({ where: { entityId: a.id, action: 'application.preference_change' } })).toBe(1);

      const cleared = await s.browser.put(`/api/vendor/applications/${a.id}/preference`).send({ preferredSlotIds: [] });
      expect(cleared.body.preferredSlots).toEqual([]);
    });

    it('refuses a taken slot, a slot of another event, and events where the organizer assigns', async () => {
      const s = await setup();
      const a = await approved(s);
      const other = await createVendor(prisma, [s.preloved.id]);
      await assignedSlot(prisma, { eventId: s.eventId, vendorProfileId: other.profile.id, categoryId: s.preloved.id, slotId: s.slots[1].id, organizerUserId: s.organizer.user.id });

      expect((await s.browser.put(`/api/vendor/applications/${a.id}/preference`).send({ preferredSlotIds: [s.slots[1].id] })).status).toBe(400);

      await prisma.event.update({ where: { id: s.eventId }, data: { slotMode: 'organizer_assigns' } });
      const res = await s.browser.put(`/api/vendor/applications/${a.id}/preference`).send({ preferredSlotIds: [s.slots[2].id] });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('The organizer assigns slots at this event');
    });

    it('refuses once a slot is assigned', async () => {
      const s = await setup();
      const { application } = await withSlot(s);

      expect((await s.browser.put(`/api/vendor/applications/${application.id}/preference`).send({ preferredSlotIds: [s.slots[2].id] })).status).toBe(409);
    });
  });

  describe('picking another slot', () => {
    it('releases the unpaid slot and sets the new pick as the preference, emailing the organizer', async () => {
      const s = await setup();
      const { application, assignment } = await withSlot(s);

      const res = await s.browser.post(`/api/vendor/applications/${application.id}/change-slot`).send({ preferredSlotIds: [s.slots[2].id] });

      expect(res.status).toBe(201);
      expect((await prisma.slotAssignment.findUniqueOrThrow({ where: { id: assignment.id } })).status).toBe('released');
      expect(await prisma.application.findUniqueOrThrow({ where: { id: application.id }, include: { preferredSlots: true } })).toMatchObject({ status: 'approved', preferredSlots: [{ slotId: s.slots[2].id }] });
      const email = await prisma.emailNotification.findFirstOrThrow({ where: { type: 'slot_released' } });
      expect(email.payload).toMatchObject({ slotLabel: 'A-01', newPreference: 'B-01' });
      expect(res.body).toMatchObject({ status: 'approved', preferredSlots: [{ label: 'B-01' }] });
    });

    it('refuses the same slot, a taken slot, a paid slot, and organizer-assigns events', async () => {
      const s = await setup();
      const { application, assignment } = await withSlot(s);
      const path = `/api/vendor/applications/${application.id}/change-slot`;

      expect((await s.browser.post(path).send({ preferredSlotIds: [s.slots[0].id] })).status).toBe(400);

      await prisma.slotAssignment.update({ where: { id: assignment.id }, data: { status: 'reserved' } });
      expect((await s.browser.post(path).send({ preferredSlotIds: [s.slots[2].id] })).status).toBe(409);

      await prisma.slotAssignment.update({ where: { id: assignment.id }, data: { status: 'assigned' } });
      await prisma.event.update({ where: { id: s.eventId }, data: { slotMode: 'organizer_assigns' } });
      expect((await s.browser.post(path).send({ preferredSlotIds: [s.slots[2].id] })).status).toBe(409);
    });

    it("is Not found for another vendor's application", async () => {
      const s = await setup();
      const { application } = await withSlot(s);
      const other = await createVendor(prisma, [s.preloved.id]);
      const browser = await signInAs(app, other.user.email);

      expect((await browser.post(`/api/vendor/applications/${application.id}/change-slot`).send({ preferredSlotIds: [s.slots[2].id] })).status).toBe(404);
      expect((await browser.put(`/api/vendor/applications/${application.id}/preference`).send({ preferredSlotIds: [] })).status).toBe(404);
    });
  });
});
