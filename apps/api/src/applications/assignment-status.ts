import { ConflictException } from '@nestjs/common';
import { writeAuditLog } from '../audit/audit-log.js';
import type { AssignmentStatus, Prisma } from '../generated/prisma/client.js';
import type { Tx } from '../prisma/prisma.service.js';

// The slot assignment status changes after assigning (spec §5, §6.3, §6.6).
export type AssignmentAction = 'reserve' | 'release' | 'remove';

const actions: Record<AssignmentAction, { from: AssignmentStatus[]; to: AssignmentStatus; refusal: string }> = {
  reserve: { from: ['assigned'], to: 'reserved', refusal: 'This slot is already reserved or no longer assigned' },
  release: { from: ['assigned'], to: 'released', refusal: 'Only a slot that is not yet paid can be released. Contact the organizer.' },
  remove: { from: ['assigned', 'reserved'], to: 'removed', refusal: 'This vendor no longer has this slot' },
};

// The one way an assignment's status changes, like changeApplicationStatus:
// the update only matches the expected status, and it is audit logged.
export async function changeAssignmentStatus(
  tx: Tx,
  input: { assignmentId: string; from: AssignmentStatus; action: AssignmentAction; actorUserId: string; data?: Prisma.SlotAssignmentUncheckedUpdateManyInput; reason?: string | null },
) {
  const rule = actions[input.action];
  if (!rule.from.includes(input.from)) throw new ConflictException(rule.refusal);
  const { count } = await tx.slotAssignment.updateMany({
    where: { id: input.assignmentId, status: input.from },
    data: { ...input.data, status: rule.to },
  });
  if (count === 0) throw new ConflictException(rule.refusal);
  await writeAuditLog(tx, {
    actorUserId: input.actorUserId,
    action: `assignment.${input.action}`,
    entityType: 'slot_assignment',
    entityId: input.assignmentId,
    changes: { status: { from: input.from, to: rule.to } },
    reason: input.reason ?? null,
  });
}
