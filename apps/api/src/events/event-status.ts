import { ConflictException } from '@nestjs/common';
import type { EventChecklist } from '@creavent/shared';
import { writeAuditLog } from '../audit/audit-log.js';
import type { EventStatus, Prisma } from '../generated/prisma/client.js';
import type { Tx } from '../prisma/prisma.service.js';

// The five required steps before opening to vendors (spec §3.1). The vendor
// floor plan is optional.
export async function checklist(tx: Tx, eventId: string): Promise<EventChecklist> {
  const event = await tx.event.findUniqueOrThrow({
    where: { id: eventId },
    include: {
      _count: {
        select: {
          categories: true,
          slots: { where: { deletedAt: null } },
          paymentMethods: { where: { isActive: true } },
        },
      },
    },
  });
  return {
    details: Boolean(event.name && event.startsAt && event.endsAt && event.venueName && event.addressLine && event.city && event.coverFileId),
    requirements: event._count.categories > 0,
    policy: event.policyText !== null,
    slots: event._count.slots > 0,
    payments: event._count.paymentMethods > 0,
  };
}

export const stepNames: Record<keyof EventChecklist, string> = {
  details: 'name, dates, venue and cover',
  requirements: 'vendor requirements',
  policy: 'cancellation and withdrawal policy',
  slots: 'at least one slot',
  payments: 'payment instructions',
};

export function missingSteps(list: EventChecklist) {
  return (Object.keys(stepNames) as (keyof EventChecklist)[]).filter((k) => !list[k]).map((k) => stepNames[k]);
}

// Once an event is open, a save may not undo a required step (flow 3). Call
// at the end of the save's transaction, so a refused save changes nothing.
export async function assertStillReady(tx: Tx, eventId: string) {
  const event = await tx.event.findUniqueOrThrow({ where: { id: eventId }, select: { status: true } });
  if (event.status === 'draft') return;
  const missing = missingSteps(await checklist(tx, eventId));
  if (missing.length) {
    throw new ConflictException(`This event is open to vendors, so it needs ${missing.join(', ')}`);
  }
}

// The event status changes (spec §3.1, architecture §3.5). Announce, complete,
// and cancel are added with Phase 4.
export type EventAction = 'open_to_vendors';

const actions: Record<EventAction, { from: EventStatus[]; to: EventStatus; refusal: string }> = {
  open_to_vendors: { from: ['draft'], to: 'open_to_vendors', refusal: 'This event is already open to vendors' },
};

// The one way an event status changes: checks the rule, writes the status
// with the action's other fields, and records it in the audit log, in the
// caller's transaction.
export async function changeEventStatus(
  tx: Tx,
  input: { eventId: string; from: EventStatus; action: EventAction; actorUserId: string; data?: Prisma.EventUpdateInput },
) {
  const rule = actions[input.action];
  if (!rule.from.includes(input.from)) throw new ConflictException(rule.refusal);
  await tx.event.update({ where: { id: input.eventId }, data: { ...input.data, status: rule.to } });
  await writeAuditLog(tx, {
    actorUserId: input.actorUserId,
    action: `event.${input.action}`,
    entityType: 'event',
    entityId: input.eventId,
    changes: { status: { from: input.from, to: rule.to } },
  });
}
