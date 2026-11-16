import type { PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { tags } from '../public/tags.js';

// The hourly job (architecture §6.1): announced events whose last day has
// ended become completed. Events that were never announced stay as they are
// (decision Q3). Returns the cache tags of the pages that changed.
export async function completeEndedEvents(prisma: PrismaClient | PrismaService, now = new Date()) {
  const ended = await prisma.event.findMany({ where: { status: 'announced', endsAt: { lte: now } }, select: { id: true } });
  if (!ended.length) return [];
  await prisma.event.updateMany({
    where: { id: { in: ended.map((e) => e.id) }, status: 'announced' },
    data: { status: 'completed', completedAt: now },
  });
  return [tags.listing, ...ended.map((e) => tags.event(e.id))];
}
