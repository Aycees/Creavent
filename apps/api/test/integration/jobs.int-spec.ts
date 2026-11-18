import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { cleanUpFiles } from '../../src/jobs/cleanup.js';
import { purgeExpiredPaymentRecords } from '../../src/jobs/retention.js';
import { assignedSlot, eventParts, readyFile } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { readyEvent } from './events.js';
import { createOrganizer, createVendor } from './factories.js';
import { MemoryStorage } from './memory-storage.js';

const DAY = 24 * 3_600_000;
const now = new Date('2027-06-01T12:00:00Z');

// The retention job (spec §6.7, data model §8) and the daily file cleanup
// (spec §11.7).
describe('jobs', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // An event with a vendor who has a slot, a proof of payment, an application
  // document, and a payment QR, ending on `endsAt`.
  async function eventWithRecords(endsAt: Date, extra: { canceledAt?: Date } = {}) {
    const organizer = await createOrganizer(prisma);
    const eventId = await readyEvent(prisma, organizer.profile.id, {
      status: extra.canceledAt ? 'canceled' : 'completed',
      startsAt: new Date(endsAt.getTime() - 6 * 3_600_000),
      endsAt,
    });
    if (extra.canceledAt) await prisma.event.update({ where: { id: eventId }, data: { canceledAt: extra.canceledAt } });
    const qr = await readyFile(prisma, organizer.user.id, 'payment_qr');
    const method = await prisma.eventPaymentMethod.findFirstOrThrow({ where: { eventId } });
    await prisma.eventPaymentMethod.update({ where: { id: method.id }, data: { qrFileId: qr.id } });
    const parts = await eventParts(prisma, eventId);
    const vendor = await createVendor(prisma);
    const { application, assignment, payment } = await assignedSlot(prisma, {
      eventId,
      vendorProfileId: vendor.profile.id,
      categoryId: parts.preloved.id,
      slotId: parts.slots[0]!.id,
      organizerUserId: organizer.user.id,
    });
    const doc = await readyFile(prisma, vendor.user.id);
    await prisma.applicationDocument.create({ data: { applicationId: application.id, fileId: doc.id } });
    const proof = await readyFile(prisma, vendor.user.id, 'payment_proof');
    await prisma.paymentProof.create({
      data: { paymentId: payment.id, eventId, vendorProfileId: vendor.profile.id, uploadedById: vendor.user.id, fileId: proof.id, paymentMethodId: method.id },
    });
    return { eventId, application, assignment, files: [qr.id, doc.id, proof.id], methodId: method.id };
  }

  describe('retention', () => {
    it('deletes payment records, proofs, QR images and documents 90 days after the event ends, keeping who had which slot', async () => {
      const old = await eventWithRecords(new Date(now.getTime() - 91 * DAY));

      const purged = await purgeExpiredPaymentRecords(prisma, now);

      expect(purged).toBe(1);
      expect(await prisma.paymentProof.count({ where: { eventId: old.eventId } })).toBe(0);
      expect(await prisma.payment.count({ where: { eventId: old.eventId } })).toBe(0);
      expect(await prisma.applicationDocument.count({ where: { applicationId: old.application.id } })).toBe(0);
      expect((await prisma.eventPaymentMethod.findUniqueOrThrow({ where: { id: old.methodId } })).qrFileId).toBeNull();
      expect((await prisma.slotAssignment.findUniqueOrThrow({ where: { id: old.assignment.id } })).paymentInstructionsSnapshot).toBeNull();
      // The files go to the cleanup job, which removes the objects.
      const files = await prisma.file.findMany({ where: { id: { in: old.files } } });
      expect(files.every((f) => f.deletedAt !== null)).toBe(true);
      expect(await prisma.application.count({ where: { id: old.application.id } })).toBe(1);
      expect(await prisma.slotAssignment.count({ where: { id: old.assignment.id } })).toBe(1);
    });

    it('also deletes the emails that carried payment amounts and details, keeping the others', async () => {
      const old = await eventWithRecords(new Date(now.getTime() - 91 * DAY));
      const payment = await prisma.payment.findFirstOrThrow({ where: { eventId: old.eventId } });
      const email = (type: 'payment_approved' | 'slot_assigned' | 'application_submitted', relatedEntityType: string, relatedEntityId: string) =>
        prisma.emailNotification.create({ data: { toEmail: 'v@example.com', type, payload: { amount: '₱800' }, status: 'sent', relatedEntityType, relatedEntityId } });
      await email('payment_approved', 'payment', payment.id);
      await email('slot_assigned', 'application', old.application.id);
      const kept = await email('application_submitted', 'application', old.application.id);

      await purgeExpiredPaymentRecords(prisma, now);

      expect((await prisma.emailNotification.findMany()).map((e) => e.id)).toEqual([kept.id]);
    });

    it("blanks the payment details in the audit log, keeping who did what and when", async () => {
      const old = await eventWithRecords(new Date(now.getTime() - 91 * DAY));
      const payment = await prisma.payment.findFirstOrThrow({ where: { eventId: old.eventId } });
      const proof = await prisma.paymentProof.findFirstOrThrow({ where: { eventId: old.eventId } });
      const actorUserId = (await prisma.event.findUniqueOrThrow({ where: { id: old.eventId }, include: { organizerProfile: true } })).organizerProfile!.userId;
      const log = (action: string, entityType: string, entityId: string, changes: object, reason: string | null = null) =>
        prisma.auditLog.create({ data: { actorUserId, action, entityType, entityId, changes, reason } });
      await log('payment.mark_paid', 'payment', payment.id, { status: { from: 'pending', to: 'approved' } }, 'Paid ₱800 in cash at the gate');
      await log('proof.reject', 'payment_proof', proof.id, { status: { from: 'submitted', to: 'rejected' } }, 'Blurry GCash receipt');
      await log('assignment.assign', 'slot_assignment', old.assignment.id, { status: { from: null, to: 'assigned' }, slot: 'A-01', price: 800 });
      const other = await log('application.approve', 'application', old.application.id, { status: { from: 'submitted', to: 'approved' } }, 'Welcome');

      await purgeExpiredPaymentRecords(prisma, now);

      const rows = await prisma.auditLog.findMany();
      const byAction = Object.fromEntries(rows.map((r) => [r.action, { changes: r.changes, reason: r.reason }]));
      expect(byAction).toEqual({
        'payment.mark_paid': { changes: null, reason: null },
        'proof.reject': { changes: null, reason: null },
        'assignment.assign': { changes: { status: { from: null, to: 'assigned' }, slot: 'A-01' }, reason: null },
        'application.approve': { changes: { status: { from: 'submitted', to: 'approved' } }, reason: 'Welcome' },
      });
      expect(rows.every((r) => r.actorUserId === actorUserId)).toBe(true);
      expect(rows.find((r) => r.action === 'application.approve')!.id).toBe(other.id);
    });

    it('keeps records of events that ended less than 90 days ago', async () => {
      const recent = await eventWithRecords(new Date(now.getTime() - 89 * DAY));

      expect(await purgeExpiredPaymentRecords(prisma, now)).toBe(0);
      expect(await prisma.payment.count({ where: { eventId: recent.eventId } })).toBe(1);
      expect(await prisma.file.count({ where: { id: { in: recent.files }, deletedAt: null } })).toBe(3);
    });

    it('counts from the cancellation for events that never took place', async () => {
      const canceled = await eventWithRecords(new Date(now.getTime() + 30 * DAY), { canceledAt: new Date(now.getTime() - 91 * DAY) });

      expect(await purgeExpiredPaymentRecords(prisma, now)).toBe(1);
      expect(await prisma.payment.count({ where: { eventId: canceled.eventId } })).toBe(0);
    });

    it('uses the configured number of days', async () => {
      const event = await eventWithRecords(new Date(now.getTime() - 31 * DAY));

      expect(await purgeExpiredPaymentRecords(prisma, now, 30)).toBe(1);
      expect(await prisma.payment.count({ where: { eventId: event.eventId } })).toBe(0);
    });

    it('does nothing the second time', async () => {
      await eventWithRecords(new Date(now.getTime() - 91 * DAY));
      await purgeExpiredPaymentRecords(prisma, now);

      expect(await purgeExpiredPaymentRecords(prisma, now)).toBe(0);
    });
  });

  describe('file cleanup', () => {
    it('deletes removed files and their objects after 24 hours', async () => {
      const storage = new MemoryStorage();
      const vendor = await createVendor(prisma);
      const old = await readyFile(prisma, vendor.user.id, 'payment_proof');
      const recent = await readyFile(prisma, vendor.user.id, 'vendor_photo');
      await storage.put('private', old.storageKey, Buffer.from('x'), 'image/webp');
      await storage.put('public', recent.storageKey, Buffer.from('x'), 'image/webp');
      await prisma.file.update({ where: { id: old.id }, data: { deletedAt: new Date(now.getTime() - 25 * 3_600_000) } });
      await prisma.file.update({ where: { id: recent.id }, data: { deletedAt: new Date(now.getTime() - 3_600_000) } });

      const result = await cleanUpFiles(prisma, storage, now);

      expect(result).toEqual({ deleted: 1, abandoned: 0, kept: 0 });
      expect(await prisma.file.findUnique({ where: { id: old.id } })).toBeNull();
      expect(await storage.get('private', old.storageKey)).toBeNull();
      expect(await prisma.file.findUnique({ where: { id: recent.id } })).not.toBeNull();
      expect(await storage.get('public', recent.storageKey)).not.toBeNull();
    });

    it('deletes uploads that never completed after 24 hours', async () => {
      const storage = new MemoryStorage();
      const vendor = await createVendor(prisma);
      const stale = await prisma.file.create({
        data: { uploadedBy: vendor.user.id, purpose: 'avatar', storageKey: 'avatar/stale.webp', mimeType: 'image/png', sizeBytes: 10, createdAt: new Date(now.getTime() - 25 * 3_600_000) },
      });
      const fresh = await prisma.file.create({
        data: { uploadedBy: vendor.user.id, purpose: 'avatar', storageKey: 'avatar/fresh.webp', mimeType: 'image/png', sizeBytes: 10, createdAt: new Date(now.getTime() - 3_600_000) },
      });
      storage.upload(`incoming/${stale.id}`, Buffer.from('x'))

      const result = await cleanUpFiles(prisma, storage, now);

      expect(result).toEqual({ deleted: 0, abandoned: 1, kept: 0 });
      expect(await prisma.file.findUnique({ where: { id: stale.id } })).toBeNull();
      expect(await storage.get('private', `incoming/${stale.id}`)).toBeNull();
      expect(await prisma.file.findUnique({ where: { id: fresh.id } })).not.toBeNull();
    });

    it("skips a removed file that something still points to, and keeps going", async () => {
      const storage = new MemoryStorage();
      const vendor = await createVendor(prisma);
      const avatar = await readyFile(prisma, vendor.user.id, 'avatar');
      await prisma.user.update({ where: { id: vendor.user.id }, data: { avatarFileId: avatar.id } });
      const other = await readyFile(prisma, vendor.user.id, 'vendor_photo');
      const old = new Date(now.getTime() - 25 * 3_600_000);
      await prisma.file.updateMany({ where: { id: { in: [avatar.id, other.id] } }, data: { deletedAt: old } });

      const result = await cleanUpFiles(prisma, storage, now);

      expect(result).toEqual({ deleted: 1, abandoned: 0, kept: 1 });
      expect(await prisma.file.findUnique({ where: { id: avatar.id } })).not.toBeNull();
    });
  });
});
