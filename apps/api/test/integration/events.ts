import type { EventStatus, PrismaClient } from '../../src/generated/prisma/client.js';

let counter = 0;

// An event with every required step filled (spec §3.1), as a draft unless
// told otherwise. Starts Fri, Jan 15, 2027, 5 PM and runs 3 days.
export async function readyEvent(
  prisma: PrismaClient,
  organizerProfileId: string,
  overrides: Partial<{
    status: EventStatus;
    name: string;
    startsAt: Date;
    endsAt: Date;
    applicationsOpen: boolean;
    applicationsCloseAt: Date | null;
    slotMode: 'organizer_assigns' | 'vendor_preference';
    moderationState: 'visible' | 'hidden';
  }> = {},
) {
  counter += 1;
  const profile = await prisma.organizerProfile.findUniqueOrThrow({ where: { id: organizerProfileId } });
  const type = await prisma.eventType.findFirstOrThrow({ where: { slug: 'flea-market' } });
  const [preloved, food] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { slug: 'preloved-clothing' } }),
    prisma.category.findFirstOrThrow({ where: { slug: 'food-and-drinks' } }),
  ]);
  const coverId = crypto.randomUUID();
  await prisma.file.create({
    data: {
      id: coverId,
      uploadedBy: profile.userId,
      purpose: 'event_cover',
      status: 'ready',
      storageKey: `event_cover/${coverId}.webp`,
      mimeType: 'image/webp',
      sizeBytes: 1000,
      width: 1600,
      height: 900,
    },
  });
  const status = overrides.status ?? 'draft';
  const event = await prisma.event.create({
    data: {
      organizerProfileId,
      eventTypeId: type.id,
      name: overrides.name ?? `Lanang Holiday Flea ${counter}`,
      slug: `lanang-holiday-flea-${counter}-${crypto.randomUUID().slice(0, 6)}`,
      description: 'Three nights of ukay-ukay and food.',
      coverFileId: coverId,
      startsAt: overrides.startsAt ?? new Date('2027-01-15T09:00:00Z'),
      endsAt: overrides.endsAt ?? new Date('2027-01-17T15:00:00Z'),
      venueName: 'Damosa Gateway',
      addressLine: 'Lanang',
      city: 'Davao City',
      vendorContactInfo: 'Rhea · 0917 482 1093',
      policyText: 'Pay within 24 hours.',
      ingressInfo: 'From 1 PM, Gate 2',
      status,
      applicationsOpen: overrides.applicationsOpen ?? status !== 'draft',
      applicationsCloseAt: overrides.applicationsCloseAt ?? null,
      openedToVendorsAt: status === 'draft' ? null : new Date(),
      announcedAt: status === 'announced' || status === 'completed' ? new Date() : null,
      slotMode: overrides.slotMode ?? 'organizer_assigns',
      moderationState: overrides.moderationState ?? 'visible',
      defaultSlotPrice: 800,
      categories: { create: [{ categoryId: preloved.id, maxVendors: 12 }, { categoryId: food.id, maxVendors: null }] },
      documents: {
        create: [
          { name: 'Barangay business clearance', sortOrder: 0 },
          { name: 'Sanitary permit', categoryId: food.id, sortOrder: 1 },
        ],
      },
      paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Rhea M.', accountName: 'Rhea M.', accountNumber: '0917 482 1093', sortOrder: 0 }] },
      slots: {
        create: [
          { label: 'A-01', section: 'Main walkway', sizeLabel: '2 × 2 m', sortOrder: 0 },
          { label: 'A-02', section: 'Main walkway', sizeLabel: '2 × 2 m', sortOrder: 1 },
          { label: 'B-01', section: 'Entrance', sizeLabel: '3 × 3 m', note: 'Near the gate', price: 1500, sortOrder: 2 },
        ],
      },
    },
  });
  return event.id;
}
