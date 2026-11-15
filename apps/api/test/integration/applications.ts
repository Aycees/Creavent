import type { FilePurpose, PrismaClient } from '../../src/generated/prisma/client.js';

// A file that went through the upload flow, ready to attach.
export async function readyFile(prisma: PrismaClient, userId: string, purpose: FilePurpose = 'application_document') {
  const id = crypto.randomUUID();
  return prisma.file.create({
    data: {
      id,
      uploadedBy: userId,
      purpose,
      status: 'ready',
      storageKey: `${purpose}/${id}.webp`,
      mimeType: 'image/webp',
      sizeBytes: 1000,
      width: 800,
      height: 600,
    },
  });
}

// The ids a vendor needs to apply to a readyEvent().
export async function eventParts(prisma: PrismaClient, eventId: string) {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { documents: { orderBy: { sortOrder: 'asc' } }, slots: { orderBy: { sortOrder: 'asc' } } },
  });
  const [preloved, food] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { slug: 'preloved-clothing' } }),
    prisma.category.findFirstOrThrow({ where: { slug: 'food-and-drinks' } }),
  ]);
  const [clearance, sanitary] = event.documents;
  return { event, preloved, food, clearance, sanitary, slots: event.slots };
}

// A submitted application straight in the database, for tests of later steps.
export async function submittedApplication(
  prisma: PrismaClient,
  input: { eventId: string; vendorProfileId: string; categoryId: string; preferredSlotId?: string | null; submittedAt?: Date },
) {
  return prisma.application.create({
    data: {
      eventId: input.eventId,
      vendorProfileId: input.vendorProfileId,
      preferredSlotId: input.preferredSlotId ?? null,
      policyTextSnapshot: 'Pay within 24 hours.',
      policyAcceptedAt: new Date(),
      submittedAt: input.submittedAt ?? new Date(),
      categories: { create: [{ categoryId: input.categoryId }] },
    },
  });
}
