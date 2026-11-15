import type { PrismaService, Tx } from '../prisma/prisma.service.js';

// Slots with an active assignment (data model §7). Every slot is open until
// slot assignment exists (feature 3.3).
export async function takenSlotIds(_db: Tx | PrismaService, _eventId: string) {
  return new Set<string>();
}
