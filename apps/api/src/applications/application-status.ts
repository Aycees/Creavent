import { ConflictException } from '@nestjs/common';
import { writeAuditLog } from '../audit/audit-log.js';
import type { ApplicationStatus, Prisma } from '../generated/prisma/client.js';
import type { Tx } from '../prisma/prisma.service.js';

// The application status changes (spec §3.3, §4.2, architecture §3.5).
export type ApplicationAction = 'withdraw' | 'approve' | 'decline' | 'remove';

const actions: Record<ApplicationAction, { from: ApplicationStatus[]; to: ApplicationStatus; refusal: string }> = {
  // While applied or approved (decided 2026-11-15). A reserved slot is checked by the caller.
  withdraw: { from: ['submitted', 'approved'], to: 'withdrawn', refusal: 'This application can no longer be withdrawn' },
  approve: { from: ['submitted'], to: 'approved', refusal: 'This application was already decided' },
  decline: { from: ['submitted'], to: 'declined', refusal: 'This application was already decided' },
  remove: { from: ['approved'], to: 'removed', refusal: 'Only approved vendors can be removed' },
};

// The one way an application's status changes: checks the rule, writes the
// status with the action's other fields, and records it in the audit log, in
// the caller's transaction. The update only matches the expected status, so
// two decisions at once can't both win.
export async function changeApplicationStatus(
  tx: Tx,
  input: { applicationId: string; from: ApplicationStatus; action: ApplicationAction; actorUserId: string; data?: Prisma.ApplicationUncheckedUpdateManyInput; reason?: string | null },
) {
  const rule = actions[input.action];
  if (!rule.from.includes(input.from)) throw new ConflictException(rule.refusal);
  const { count } = await tx.application.updateMany({
    where: { id: input.applicationId, status: input.from },
    data: { ...input.data, status: rule.to },
  });
  if (count === 0) throw new ConflictException(rule.refusal);
  await writeAuditLog(tx, {
    actorUserId: input.actorUserId,
    action: `application.${input.action}`,
    entityType: 'application',
    entityId: input.applicationId,
    changes: { status: { from: input.from, to: rule.to } },
    reason: input.reason ?? null,
  });
}
