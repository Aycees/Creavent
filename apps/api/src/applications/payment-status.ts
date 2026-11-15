import { ConflictException } from '@nestjs/common';
import { writeAuditLog } from '../audit/audit-log.js';
import type { PaymentStatus, Prisma, ProofStatus } from '../generated/prisma/client.js';
import type { Tx } from '../prisma/prisma.service.js';

// The payment and proof status changes (spec §6.3, §6.4, data model §5.7,
// architecture §3.5). Like the application and assignment ones, each update
// only matches the expected status and is audit logged.
const paymentActions = {
  submit: { from: ['pending', 'rejected'], to: 'submitted' },
  approve: { from: ['pending', 'rejected', 'submitted'], to: 'approved' },
  reject: { from: ['submitted'], to: 'rejected' },
} satisfies Record<string, { from: PaymentStatus[]; to: PaymentStatus }>;

const proofActions = {
  approve: { from: ['submitted'], to: 'approved' },
  reject: { from: ['submitted'], to: 'rejected' },
} satisfies Record<string, { from: ProofStatus[]; to: ProofStatus }>;

const STALE = 'This payment changed meanwhile. Refresh and try again.';

export async function changePaymentStatus(
  tx: Tx,
  input: { paymentId: string; from: PaymentStatus; action: keyof typeof paymentActions; actorUserId: string; data?: Prisma.PaymentUncheckedUpdateManyInput; reason?: string | null },
) {
  const rule: { from: PaymentStatus[]; to: PaymentStatus } = paymentActions[input.action];
  if (!rule.from.includes(input.from)) throw new ConflictException(STALE);
  const { count } = await tx.payment.updateMany({
    where: { id: input.paymentId, status: input.from, archivedAt: null },
    data: { ...input.data, status: rule.to },
  });
  if (count === 0) throw new ConflictException(STALE);
  await writeAuditLog(tx, {
    actorUserId: input.actorUserId,
    action: `payment.${input.action}`,
    entityType: 'payment',
    entityId: input.paymentId,
    changes: { status: { from: input.from, to: rule.to } },
    reason: input.reason ?? null,
  });
}

export async function changeProofStatus(
  tx: Tx,
  input: { proofId: string; action: keyof typeof proofActions; actorUserId: string; data?: Prisma.PaymentProofUncheckedUpdateManyInput; reason?: string | null },
) {
  const rule: { from: ProofStatus[]; to: ProofStatus } = proofActions[input.action];
  const { count } = await tx.paymentProof.updateMany({
    where: { id: input.proofId, status: { in: rule.from }, archivedAt: null },
    data: { ...input.data, status: rule.to },
  });
  if (count === 0) throw new ConflictException('This proof was already reviewed');
  await writeAuditLog(tx, {
    actorUserId: input.actorUserId,
    action: `proof.${input.action}`,
    entityType: 'payment_proof',
    entityId: input.proofId,
    changes: { status: { from: 'submitted', to: rule.to } },
    reason: input.reason ?? null,
  });
}
