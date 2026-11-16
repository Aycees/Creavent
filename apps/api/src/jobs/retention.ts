import { appConfig } from '../config.js';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const DAY = 24 * 3_600_000;

// The retention job (spec §6.7, data model §8): `proof_retention_days` after an
// event's last day, or after it was canceled, its payment records go:
// proofs, payments, payment QR images, the payment details copied onto each
// assignment, and the application documents. Who had which slot stays.
// Files are marked removed; the cleanup job deletes the objects. Returns the
// number of events purged.
export async function purgeExpiredPaymentRecords(prisma: PrismaClient | PrismaService, now = new Date(), days = appConfig().proofRetentionDays) {
  const cutoff = new Date(now.getTime() - days * DAY);
  const events = await prisma.$queryRaw<{ id: string }[]>`
    SELECT e.id FROM events e
    WHERE COALESCE(e.canceled_at, e.ends_at) < ${cutoff}
      AND (
        EXISTS (SELECT 1 FROM payments p WHERE p.event_id = e.id)
        OR EXISTS (SELECT 1 FROM event_payment_methods m WHERE m.event_id = e.id AND m.qr_file_id IS NOT NULL)
        OR EXISTS (SELECT 1 FROM application_documents d JOIN applications a ON a.id = d.application_id WHERE a.event_id = e.id)
        OR EXISTS (SELECT 1 FROM slot_assignments s WHERE s.event_id = e.id AND s.payment_instructions_snapshot IS NOT NULL)
      )`;
  for (const { id } of events) {
    await prisma.$transaction(async (tx) => {
      const [proofs, methods, documents] = await Promise.all([
        tx.paymentProof.findMany({ where: { eventId: id }, select: { fileId: true } }),
        tx.eventPaymentMethod.findMany({ where: { eventId: id, qrFileId: { not: null } }, select: { qrFileId: true } }),
        tx.applicationDocument.findMany({ where: { application: { eventId: id } }, select: { fileId: true } }),
      ]);
      await tx.paymentProof.deleteMany({ where: { eventId: id } });
      await tx.payment.deleteMany({ where: { eventId: id } });
      await tx.applicationDocument.deleteMany({ where: { application: { eventId: id } } });
      await tx.eventPaymentMethod.updateMany({ where: { eventId: id }, data: { qrFileId: null } });
      await tx.slotAssignment.updateMany({ where: { eventId: id }, data: { paymentInstructionsSnapshot: Prisma.DbNull } });
      const fileIds = [...proofs.map((p) => p.fileId), ...methods.map((m) => m.qrFileId!), ...documents.map((d) => d.fileId)];
      await tx.file.updateMany({ where: { id: { in: fileIds }, deletedAt: null }, data: { deletedAt: now } });
    });
  }
  return events.length;
}
