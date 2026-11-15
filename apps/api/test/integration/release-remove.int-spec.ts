import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, signInAs } from './app.js';
import { assignedSlot, eventParts, readyFile, submittedApplication } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// Feature 3.6: release, remove, change (spec §6.6, flow 9).
describe('releasing and removing', () => {
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

  async function setup() {
    const organizer = await createOrganizer(prisma);
    const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors' });
    const parts = await eventParts(prisma, eventId);
    const vendor = await createVendor(prisma, [parts.preloved.id]);
    const slot = await assignedSlot(prisma, {
      eventId,
      vendorProfileId: vendor.profile.id,
      categoryId: parts.preloved.id,
      slotId: parts.slots[0].id,
      organizerUserId: organizer.user.id,
    });
    const vendorBrowser = await signInAs(app, vendor.user.email);
    const organizerBrowser = await signInAs(app, organizer.user.email);
    return { organizer, eventId, ...parts, vendor, ...slot, vendorBrowser, organizerBrowser };
  }

  type Setup = Awaited<ReturnType<typeof setup>>;
  const release = (s: Setup) => s.vendorBrowser.post(`/api/vendor/applications/${s.application.id}/release`).send({});
  const remove = (s: Setup, body: Record<string, unknown> = { canReapply: false }, applicationId = s.application.id) =>
    s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/applications/${applicationId}/remove`).send(body);

  describe('the vendor releases an assigned slot', () => {
    it('opens the slot again, archives the payment, keeps the vendor approved, and emails the organizer', async () => {
      const s = await setup();

      const res = await release(s);

      expect(res.status).toBe(201);
      const assignment = await prisma.slotAssignment.findUniqueOrThrow({ where: { id: s.assignment.id } });
      expect(assignment).toMatchObject({ status: 'released', endedById: s.vendor.user.id });
      expect(assignment.endedAt).not.toBeNull();
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: s.payment.id } })).archivedAt).not.toBeNull();
      expect((await prisma.application.findUniqueOrThrow({ where: { id: s.application.id } })).status).toBe('approved');
      expect(await prisma.emailNotification.count({ where: { type: 'slot_released', userId: s.organizer.user.id } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { entityId: s.assignment.id, action: 'assignment.release' } })).toBe(1);
      expect(res.body.status).toBe('approved');
      const vendors = await s.organizerBrowser.get(`/api/organizer/events/${s.eventId}/vendors`);
      expect(vendors.body.glance.open).toBe(3);
      expect(vendors.body.unassigned).toHaveLength(1);
    });

    it("can't release a reserved slot", async () => {
      const s = await setup();
      await prisma.slotAssignment.update({ where: { id: s.assignment.id }, data: { status: 'reserved' } });

      const res = await release(s);

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Your payment is approved, so contact the organizer to cancel');
    });

    it("is Not found for another vendor", async () => {
      const s = await setup();
      const other = await createVendor(prisma, [s.preloved.id]);
      const browser = await signInAs(app, other.user.email);

      expect((await browser.post(`/api/vendor/applications/${s.application.id}/release`).send({})).status).toBe(404);
    });
  });

  describe('the organizer removes a vendor', () => {
    it('frees a reserved slot, archives the payment and proofs, and emails the vendor', async () => {
      const s = await setup();
      const proofFile = await readyFile(prisma, s.vendor.user.id, 'payment_proof');
      const method = await prisma.eventPaymentMethod.findFirstOrThrow({ where: { eventId: s.eventId } });
      const proof = await prisma.paymentProof.create({
        data: { paymentId: s.payment.id, eventId: s.eventId, vendorProfileId: s.vendor.profile.id, uploadedById: s.vendor.user.id, fileId: proofFile.id, paymentMethodId: method.id, status: 'approved' },
      });
      await prisma.slotAssignment.update({ where: { id: s.assignment.id }, data: { status: 'reserved' } });

      const res = await remove(s, { canReapply: false, note: 'Agreed cancellation' });

      expect(res.status).toBe(201);
      expect((await prisma.slotAssignment.findUniqueOrThrow({ where: { id: s.assignment.id } })).status).toBe('removed');
      expect(await prisma.application.findUniqueOrThrow({ where: { id: s.application.id } })).toMatchObject({
        status: 'removed',
        canReapply: false,
        removedById: s.organizer.user.id,
        removalNote: 'Agreed cancellation',
      });
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: s.payment.id } })).archivedAt).not.toBeNull();
      expect((await prisma.paymentProof.findUniqueOrThrow({ where: { id: proof.id } })).archivedAt).not.toBeNull();
      expect(await prisma.emailNotification.count({ where: { type: 'vendor_removed', toEmail: s.vendor.user.email } })).toBe(1);
      expect(res.body.glance).toMatchObject({ open: 3, reserved: 0 });
      // The records stay readable for both sides.
      expect((await s.vendorBrowser.get(`/api/files/${proofFile.id}`)).status).toBe(302);
      expect((await s.organizerBrowser.get(`/api/files/${proofFile.id}`)).status).toBe(302);
      const page = await s.vendorBrowser.get(`/api/vendor/applications/${s.application.id}`);
      expect(page.body).toMatchObject({ status: 'removed', removalNote: 'Agreed cancellation', assignment: { status: 'removed', archived: true } });
      expect(page.body.assignment.proofs[0]).toMatchObject({ archived: true });
    });

    it('removes an approved vendor who has no slot yet', async () => {
      const s = await setup();
      const other = await createVendor(prisma, [s.preloved.id]);
      const app2 = await submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: other.profile.id, categoryId: s.preloved.id });
      await prisma.application.update({ where: { id: app2.id }, data: { status: 'approved' } });

      const res = await remove(s, { canReapply: true }, app2.id);

      expect(res.status).toBe(201);
      expect(await prisma.application.findUniqueOrThrow({ where: { id: app2.id } })).toMatchObject({ status: 'removed', canReapply: true });
    });

    it('lets the organizer change a slot by removing and assigning again', async () => {
      const s = await setup();
      await remove(s, { canReapply: true });
      const vendorBrowser = s.vendorBrowser;
      const reapply = await vendorBrowser.post(`/api/vendor/events/${s.event.slug}/applications`).send({
        categoryIds: [s.preloved.id],
        documents: [{ requirementId: s.clearance.id, fileIds: [(await readyFile(prisma, s.vendor.user.id)).id] }],
      });
      expect(reapply.status).toBe(201);
      await s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/applications/${reapply.body.id}/approve`).send({});

      const res = await s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/assignments`).send({ applicationId: reapply.body.id, slotIds: [s.slots[1].id] });

      expect(res.status).toBe(201);
      expect(res.body.assignments.map((a: { slotLabel: string }) => a.slotLabel)).toEqual(['A-02']);
    });

    it('refuses a submitted application, another organizer, and a hidden event', async () => {
      const s = await setup();
      const other = await createVendor(prisma, [s.preloved.id]);
      const waiting = await submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: other.profile.id, categoryId: s.preloved.id });
      expect((await remove(s, { canReapply: true }, waiting.id)).status).toBe(409);
      expect((await remove(s, {})).status).toBe(400);

      const stranger = await createOrganizer(prisma);
      const strangerBrowser = await signInAs(app, stranger.user.email);
      expect((await strangerBrowser.post(`/api/organizer/events/${s.eventId}/applications/${s.application.id}/remove`).send({ canReapply: true })).status).toBe(404);

      await prisma.event.update({ where: { id: s.eventId }, data: { moderationState: 'hidden' } });
      // Removing stays possible on a hidden event, so an organizer can still let vendors go.
      expect((await remove(s, { canReapply: true })).status).toBe(201);
    });
  });
});
