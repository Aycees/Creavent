import type { PrismaService, Tx } from '../prisma/prisma.service.js';

export const ACTIVE = ['assigned', 'reserved'] as const;

// Slots with an active assignment, taken for vendors (data model §7).
export async function takenSlotIds(db: Tx | PrismaService, eventId: string) {
  const rows = await db.slotAssignment.findMany({ where: { eventId, status: { in: [...ACTIVE] } }, select: { slotId: true } });
  return new Set(rows.map((r) => r.slotId));
}

// "Overdue payment" (data model §7): assigned, payment pending or rejected,
// deadline passed. Shown, never enforced (spec §6.4).
export function isOverdue(a: { status: string; deadlineAt: Date; payment: { status: string } | null }, now = new Date()) {
  return a.status === 'assigned' && (a.payment?.status === 'pending' || a.payment?.status === 'rejected') && a.deadlineAt < now;
}
