import type { Tx } from '../prisma/prisma.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

// Approved applications per category at an event, for spots left and the
// category counter (data model §7).
export async function approvedPerCategory(db: Tx | PrismaService, eventId: string) {
  const rows = await db.applicationCategory.groupBy({
    by: ['categoryId'],
    where: { application: { eventId, status: 'approved' } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.categoryId, r._count._all]));
}

// "5 of 12 spots left": the limit minus approved vendors, never below zero.
// Null when the organizer set no limit. A guide only (spec §3.2).
export function spotsLeft(max: number | null, approved: number) {
  return max === null ? null : Math.max(0, max - approved);
}
