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

// What the organizer does next for a missing step (dashboard, spec §3.8).
export const stepActions: Record<keyof EventChecklist, string> = {
  details: 'Fill in details',
  requirements: 'Add requirements',
  policy: 'Write your policy',
  slots: 'Add slots',
  payments: 'Add payment details',
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

// The event status changes (spec §3.1, architecture §3.5, decision Q7).
// Completing is done by the hourly job (complete-events.ts), which has no
// user to log.
export type EventAction = 'open_to_vendors' | 'announce' | 'announce_popup' | 'undo_announce' | 'cancel';

const actions: Record<EventAction, { from: EventStatus[]; to: EventStatus; refusal: string }> = {
  open_to_vendors: { from: ['draft'], to: 'open_to_vendors', refusal: 'This event is already open to vendors' },
  announce: { from: ['open_to_vendors'], to: 'announced', refusal: 'Only an event open to vendors can be announced' },
  // A pop-up is never open to vendors (rule 6.14).
  announce_popup: { from: ['draft'], to: 'announced', refusal: 'This pop-up is already announced' },
  undo_announce: { from: ['announced'], to: 'open_to_vendors', refusal: 'Only an announced event can be taken off the listing' },
  cancel: { from: ['open_to_vendors', 'announced'], to: 'canceled', refusal: 'Only an event open to vendors or announced can be canceled' },
};

// The one way an event status changes: checks the rule, writes the status
// with the action's other fields, and records it in the audit log, in the
// caller's transaction.
export async function changeEventStatus(
  tx: Tx,
  input: { eventId: string; from: EventStatus; action: EventAction; actorUserId: string; data?: Prisma.EventUpdateInput; reason?: string | null },
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
    reason: input.reason ?? null,
  });
}

// The organizer of an event vendors apply to. Only organizer events have
// applications, slots, and payments (rule 6.16), so a pop-up never gets here.
export function organizerOf<T>(event: { organizerProfile: T | null }): T {
  if (!event.organizerProfile) throw new ConflictException('This is a pop-up, which has no organizer');
  return event.organizerProfile;
}
