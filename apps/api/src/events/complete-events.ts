import type { PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

// The hourly job (architecture §6.1): announced events whose last day has
// ended become completed. Events that were never announced stay as they are
// (decision Q3). Returns how many changed.
export async function completeEndedEvents(prisma: PrismaClient | PrismaService, now = new Date()) {
  const { count } = await prisma.event.updateMany({
    where: { status: 'announced', endsAt: { lte: now } },
    data: { status: 'completed', completedAt: now },
  });
  return count;
}
