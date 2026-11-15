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
  input: { eventId: string; vendorProfileId: string; categoryId: string; preferredSlotId?: string | null; preferredSlotIds?: string[]; slotsRequested?: number; submittedAt?: Date },
) {
  const preferred = input.preferredSlotIds ?? (input.preferredSlotId ? [input.preferredSlotId] : []);
  return prisma.application.create({
    data: {
      eventId: input.eventId,
      vendorProfileId: input.vendorProfileId,
      slotsRequested: input.slotsRequested ?? Math.max(1, preferred.length),
      preferredSlots: { create: preferred.map((slotId) => ({ slotId })) },
      policyTextSnapshot: 'Pay within 24 hours.',
      policyAcceptedAt: new Date(),
      submittedAt: input.submittedAt ?? new Date(),
      categories: { create: [{ categoryId: input.categoryId }] },
    },
  });
}

// An approved application with an assigned slot and a pending payment,
// straight in the database, for tests of later steps.
export async function assignedSlot(
  prisma: PrismaClient,
  input: { eventId: string; vendorProfileId: string; categoryId: string; slotId: string; slotIds?: string[]; organizerUserId: string; deadlineAt?: Date; price?: number },
) {
  const slotIds = input.slotIds ?? [input.slotId];
  const application = await submittedApplication(prisma, { ...input, slotsRequested: slotIds.length });
  await prisma.application.update({ where: { id: application.id }, data: { status: 'approved' } });
  const vendor = await prisma.vendorProfile.findUniqueOrThrow({ where: { id: input.vendorProfileId } });
  const methods = await prisma.eventPaymentMethod.findMany({ where: { eventId: input.eventId, isActive: true } });
  const assignment = await prisma.slotAssignment.create({
    data: {
      slots: { create: slotIds.map((slotId) => ({ slotId, priceLocked: (input.price ?? 800) / slotIds.length })) },
      eventId: input.eventId,
      applicationId: application.id,
      vendorProfileId: input.vendorProfileId,
      priceLocked: input.price ?? 800,
      paymentInstructionsSnapshot: methods.map((m) => ({
        id: m.id,
        channel: m.channel,
        label: m.label,
        accountName: m.accountName,
        accountNumber: m.accountNumber,
        qrFileId: m.qrFileId,
        notes: m.notes,
      })),
      assignedAt: new Date(),
      assignedById: input.organizerUserId,
      deadlineAt: input.deadlineAt ?? new Date(Date.now() + 24 * 3_600_000),
      payment: {
        create: { eventId: input.eventId, payerUserId: vendor.userId, payeeUserId: input.organizerUserId, amountDue: input.price ?? 800 },
      },
    },
    include: { payment: true },
  });
  return { application, assignment, payment: assignment.payment! };
}
