import type { PrismaService, Tx } from '../prisma/prisma.service.js';

export const ACTIVE = ['assigned', 'reserved'] as const;

// Slots vendors can't get (data model §7): in an active assignment, or set
// aside by the organizer (decision P1).
export async function takenSlotIds(db: Tx | PrismaService, eventId: string) {
  const [assigned, setAside] = await Promise.all([
    db.slotAssignmentSlot.findMany({ where: { active: true, slot: { eventId } }, select: { slotId: true } }),
    db.slot.findMany({ where: { eventId, deletedAt: null, setAsideAt: { not: null } }, select: { id: true } }),
  ]);
  return new Set([...assigned.map((r) => r.slotId), ...setAside.map((s) => s.id)]);
}

// An assignment's slots in slot list order, and as one line: "B-03, B-04"
// (decision P6).
export function sortedSlots<T extends { slot: { label: string; sortOrder: number } }>(rows: T[]) {
  return [...rows].sort((a, b) => a.slot.sortOrder - b.slot.sortOrder || a.slot.label.localeCompare(b.slot.label));
}
export function slotLabel(rows: { slot: { label: string; sortOrder: number } }[]) {
  return sortedSlots(rows)
    .map((r) => r.slot.label)
    .join(', ');
}

// Preferred slots as the organizer or vendor sees them now: still open,
// taken (or set aside), or deleted ("No longer available", spec §5).
export function preferenceStates(rows: { slot: { id: string; label: string; sortOrder: number; deletedAt: Date | null } }[], taken: Set<string>) {
  return sortedSlots(rows).map(({ slot }) => ({
    id: slot.id,
    label: slot.label,
    state: slot.deletedAt ? ('removed' as const) : taken.has(slot.id) ? ('taken' as const) : ('open' as const),
  }));
}

// "Overdue payment" (data model §7): assigned, payment pending or rejected,
// deadline passed. Shown, never enforced (spec §6.4).
export function isOverdue(a: { status: string; deadlineAt: Date; payment: { status: string } | null }, now = new Date()) {
  return a.status === 'assigned' && (a.payment?.status === 'pending' || a.payment?.status === 'rejected') && a.deadlineAt < now;
}
