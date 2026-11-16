// Seed data for local development and staging only (architecture §5.3), so
// every Phase 1 and Phase 2 screen can be seen without clicking through signup:
//
//   admin@creavent.test      admin
//   vendor@creavent.test     vendor, onboarding finished
//   organizer@creavent.test  organizer, approved
//   pending@, pending2@, rejected@, later@creavent.test
//                            organizers in each other approval state
//
// Events (Phase 2), for organizer@ unless noted. Seeded events have no cover
// image, so an open one asks for a cover before its details can be saved.
//   Matina Night Flea, January  draft, payment details missing (4 of 5 steps)
//   Lanang Holiday Flea         open to vendors, vendors choose a preferred slot,
//                               up to 2 slots per vendor, A-16 set aside
//   Bajada Christmas Flea       open to vendors, applications closed
//   Mintal Weekend Bazaar       pending@'s ready draft, waiting for approval
//
// Applications (Phase 3), at Lanang Holiday Flea:
//   vendor2@ Tahi-Tahi PH    submitted, prefers B-03
//   vendor3@ Thrift Kingdom  withdrawn
//   vendor4@ Paper Bayani    approved, wants 2 slots, prefers A-05 and A-06
//   vendor5@ Tanim Plant Co. declined with a note
//   vendor6@ Habi Mindanao   slots A-01 and A-02, payment waiting
//   vendor7@ Kalye Kicks     slot B-04, reserved (payment approved)
//   vendor8@ Bulak Studio    slot A-03, payment overdue
//   vendor9@ Retro Laruan    removed, can't apply again
//
// The last section ("A populated platform") adds 4 more organizers, 3 in other
// states, 23 more vendors, and about 20 more events with their bookings and
// applications. It lists them.
//
// All use SEED_PASSWORD from apps/api/.env. Run with `pnpm db:seed` from the
// repo root. Safe to run again: existing accounts are left as they are.
import { hashPassword } from 'better-auth/crypto';
import type { ApprovalStatus, Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Only a database on this machine, unless ALLOW_SEED=staging says otherwise:
// the seed creates an admin with a known password.
const dbHost = new URL(process.env.DATABASE_URL ?? 'postgresql://x@localhost').hostname;
const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(dbHost);
if (!local && process.env.ALLOW_SEED !== 'staging') {
  throw new Error(`Refusing to seed the database on ${dbHost}. Set ALLOW_SEED=staging to seed staging.`);
}
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'staging') {
  throw new Error('The seed is for local and staging databases only');
}
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 8) throw new Error('Set SEED_PASSWORD (8+ characters) in apps/api/.env');

const prisma = new PrismaService();
const hash = await hashPassword(password);
const terms = process.env.TERMS_VERSION ?? '2026-11-12';
const privacy = process.env.PRIVACY_VERSION ?? '2026-11-12';

async function user(email: string, fullName: string, extra: { isAdmin?: boolean; phone?: string } = {}) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const created = await prisma.user.create({
    data: { email, fullName, emailVerified: true, ageConfirmedAt: new Date(), ...extra },
  });
  await prisma.account.create({ data: { userId: created.id, providerId: 'credential', accountId: created.id, password: hash } });
  await prisma.legalAcceptance.createMany({
    data: [
      { userId: created.id, document: 'terms', version: terms },
      { userId: created.id, document: 'privacy', version: privacy },
    ],
  });
  return created;
}

async function organizer(
  email: string,
  displayName: string,
  status: ApprovalStatus,
  daysAgo: number,
  extra: { city?: string; about?: string; phone?: string; ownerName?: string } = {},
) {
  const u = await user(email, extra.ownerName ?? `${displayName} Owner`, { phone: extra.phone ?? '+639171234567' });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@creavent.test' } });
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await prisma.organizerProfile.upsert({
    where: { userId: u.id },
    update: {},
    create: {
      userId: u.id,
      displayName,
      slug,
      city: extra.city ?? 'Davao City',
      about: extra.about ?? 'Monthly community market.',
      socialLinks: [`https://facebook.com/${slug}`],
    },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: u.id, role: 'organizer' } },
    update: {},
    create: {
      userId: u.id,
      role: 'organizer',
      onboardingStep: 4,
      approvalStatus: status,
      contactEmail: email,
      approvalSubmittedAt: status === 'not_submitted' ? null : new Date(Date.now() - daysAgo * 86_400_000),
      rejectionReason: status === 'rejected' ? 'Add a page that shows your past events' : null,
      // Decided requests carry the review, so the profile marks reviewed links.
      ...(status === 'approved' || status === 'rejected'
        ? { reviewedById: admin.id, reviewedAt: new Date(Date.now() - (daysAgo - 1) * 86_400_000), reviewedLinks: [`https://facebook.com/${slug}`] }
        : {}),
    },
  });
}

await user('admin@creavent.test', 'Ana Admin', { isAdmin: true });

const vendor = await user('vendor@creavent.test', 'Lola Reyes', { phone: '+639174821093' });
const preloved = await prisma.category.findUniqueOrThrow({ where: { slug: 'preloved-clothing' } });
const profile = await prisma.vendorProfile.upsert({
  where: { userId: vendor.id },
  update: {},
  create: { userId: vendor.id, shopName: "Lola's Ukay", slug: 'lolas-ukay', description: 'Hand-picked preloved tops and denim.', socialLinks: [] },
});
await prisma.vendorProfileCategory.upsert({
  where: { vendorProfileId_categoryId: { vendorProfileId: profile.id, categoryId: preloved.id } },
  update: {},
  create: { vendorProfileId: profile.id, categoryId: preloved.id },
});
await prisma.userRole.upsert({
  where: { userId_role: { userId: vendor.id, role: 'vendor' } },
  update: {},
  create: { userId: vendor.id, role: 'vendor', onboardingStep: 4 },
});

await organizer('organizer@creavent.test', 'Matina Night Flea', 'approved', 10);
await organizer('pending@creavent.test', 'Bazaar ng Mintal', 'pending_review', 3);
await organizer('pending2@creavent.test', 'Lanang Holiday Flea', 'pending_review', 1);
await organizer('rejected@creavent.test', 'Bajada Ukay', 'rejected', 5);
await organizer('later@creavent.test', 'Toril Sunday Market', 'not_submitted', 0);

// Manila time, as the organizer enters it.
const at = (date: string, time: string) => new Date(`${date}T${time}:00+08:00`);

async function event(
  email: string,
  slug: string,
  data: Omit<Prisma.EventUncheckedCreateInput, 'organizerProfileId' | 'eventTypeId' | 'slug'>,
  typeSlug = 'flea-market',
) {
  if (await prisma.event.findUnique({ where: { slug } })) return;
  const owner = await prisma.organizerProfile.findFirstOrThrow({ where: { user: { email } } });
  const type = await prisma.eventType.findUniqueOrThrow({ where: { slug: typeSlug } });
  await prisma.event.create({ data: { ...data, slug, organizerProfileId: owner.id, eventTypeId: type.id } });
}

const category = async (slug: string) => (await prisma.category.findUniqueOrThrow({ where: { slug } })).id;
const [vintage, crafts, food, plants] = await Promise.all(['vintage', 'handmade-and-crafts', 'food-and-drinks', 'plants'].map(category));
const policy = [
  'Pay your slot fee within 24 hours of being assigned a slot. Unpaid slots may be given to another vendor.',
  'If you withdraw 7 or more days before the event, we refund 50% of your fee. Within 7 days, fees are not refundable.',
  'If we cancel the event, you get a full refund within 5 days.',
].join('\n\n');
const row = (prefix: string, count: number, section: string, sizeLabel: string, start: number, price?: number) =>
  Array.from({ length: count }, (_, i) => ({
    label: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    section,
    sizeLabel,
    price: price ?? null,
    sortOrder: start + i,
  }));
const venue = (venueName: string, addressLine: string, city = 'Davao City', province?: string) => ({
  venueName,
  addressLine,
  city,
  ...(province ? { province } : {}),
});
const contact = 'Joanna Lim · 0928 115 7720 · text for questions';

await event('organizer@creavent.test', 'matina-night-flea-january', {
  name: 'Matina Night Flea, January',
  description: 'Our monthly night market at Matina Town Square: ukay-ukay, vintage denim, local crafts, plants and street food from sundown until 11.',
  startsAt: at('2027-01-16', '17:00'),
  endsAt: at('2027-01-16', '23:00'),
  ...venue('Matina Town Square', 'MacArthur Highway, Matina'),
  vendorContactInfo: contact,
  applicationsCloseAt: at('2027-01-07', '23:59'),
  ingressInfo: 'From 3 PM, Gate 2',
  policyText: policy,
  defaultSlotPrice: 800,
  categories: { create: [{ categoryId: preloved.id, maxVendors: 12 }, { categoryId: vintage, maxVendors: 6 }, { categoryId: food, maxVendors: 6 }] },
  documents: { create: [{ name: 'Barangay business clearance', sortOrder: 0 }, { name: 'Sanitary permit', categoryId: food, sortOrder: 1 }] },
  slots: { create: [...row('A', 16, 'Main walkway', '2 × 2 m', 0), ...row('B', 12, 'Entrance', '3 × 3 m', 16, 1500)] },
});

await event('organizer@creavent.test', 'lanang-holiday-flea', {
  name: 'Lanang Holiday Flea',
  description: 'Three nights of preloved finds, crafts and food before Christmas.',
  startsAt: at('2026-12-18', '15:00'),
  endsAt: at('2026-12-20', '23:00'),
  ...venue('Damosa Gateway', 'Lanang'),
  vendorContactInfo: contact,
  applicationsCloseAt: at('2026-12-10', '23:59'),
  policyText: policy,
  status: 'open_to_vendors',
  openedToVendorsAt: new Date(),
  applicationsOpen: true,
  slotMode: 'vendor_preference',
  maxSlotsPerVendor: 2,
  defaultSlotPrice: 800,
  categories: {
    create: [
      { categoryId: preloved.id, maxVendors: 12 },
      { categoryId: crafts, maxVendors: 8 },
      { categoryId: vintage, maxVendors: 6 },
      { categoryId: food, maxVendors: 6 },
      { categoryId: plants, maxVendors: 4 },
    ],
  },
  documents: { create: [{ name: 'Barangay business clearance', sortOrder: 0 }, { name: 'Sanitary permit', categoryId: food, sortOrder: 1 }] },
  paymentMethods: {
    create: [
      { channel: 'gcash', label: 'GCash, Joanna L.', accountName: 'Joanna L.', accountNumber: '0928 115 7720', sortOrder: 0 },
      { channel: 'bank', label: 'Bank transfer, Joanna Lim', accountName: 'Joanna Lim', accountNumber: '1234 5678 90', notes: 'BPI savings', sortOrder: 1 },
    ],
  },
  slots: {
    create: [
      ...row('A', 16, 'Main walkway', '2 × 2 m', 0).map((s) => (s.label === 'A-16' ? { ...s, setAsideAt: new Date(), setAsideNote: 'Organizer booth' } : s)),
      ...row('B', 12, 'Entrance', '3 × 3 m', 16, 1500),
      ...row('F', 6, 'Food row', '3 × 3 m', 28, 1200).map((s) => ({ ...s, note: 'With power' })),
    ],
  },
});

await event('organizer@creavent.test', 'bajada-christmas-flea', {
  name: 'Bajada Christmas Flea',
  description: 'A one-night Christmas market at the covered court.',
  startsAt: at('2026-12-12', '16:00'),
  endsAt: at('2026-12-12', '22:00'),
  ...venue('Bajada Covered Court', 'J.P. Laurel Avenue, Bajada'),
  vendorContactInfo: contact,
  policyText: policy,
  status: 'open_to_vendors',
  openedToVendorsAt: new Date(),
  applicationsOpen: false,
  defaultSlotPrice: 600,
  categories: { create: [{ categoryId: preloved.id, maxVendors: 10 }, { categoryId: crafts, maxVendors: null }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Joanna L.', accountName: 'Joanna L.', accountNumber: '0928 115 7720', sortOrder: 0 }] },
  slots: { create: row('C', 20, 'Covered court', '2 × 2 m', 0) },
});

await event('pending@creavent.test', 'mintal-weekend-bazaar', {
  name: 'Mintal Weekend Bazaar',
  description: 'Two days of bazaar stalls in Mintal.',
  startsAt: at('2027-02-06', '09:00'),
  endsAt: at('2027-02-07', '18:00'),
  ...venue('Mintal Public Market Grounds', 'Mintal, Tugbok'),
  vendorContactInfo: 'Text 0917 000 1111',
  policyText: policy,
  defaultSlotPrice: 500,
  categories: { create: [{ categoryId: preloved.id, maxVendors: null }] },
  paymentMethods: { create: [{ channel: 'maya', label: 'Maya, Bazaar ng Mintal', accountName: 'Bazaar ng Mintal', accountNumber: '0917 000 1111', sortOrder: 0 }] },
  slots: { create: row('M', 10, 'Grounds', '2 × 2 m', 0) },
});

// Phase 3: more vendors, and applications to Lanang Holiday Flea in each
// state. vendor@ has none there, so the Apply page can be tried by hand.
// Seeded applications have no document files.
async function seedVendor(
  email: string,
  fullName: string,
  shopName: string,
  slug: string,
  categoryIds: string[],
  extra: { description?: string; products?: string; city?: string; phone?: string; socialLinks?: string[] } = {},
) {
  const { phone = '+639181234567', ...details } = extra;
  const u = await user(email, fullName, { phone });
  const p = await prisma.vendorProfile.upsert({
    where: { userId: u.id },
    update: {},
    create: { userId: u.id, shopName, slug, socialLinks: [], ...details, categories: { create: categoryIds.map((categoryId) => ({ categoryId })) } },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: u.id, role: 'vendor' } },
    update: {},
    create: { userId: u.id, role: 'vendor', onboardingStep: 4 },
  });
  return p;
}

async function application(
  vendorProfileId: string,
  eventSlug: string,
  categoryId: string,
  data: Partial<Prisma.ApplicationUncheckedCreateInput> & { preferredLabels?: string[]; daysAgo?: number } = {},
) {
  const target = await prisma.event.findUniqueOrThrow({ where: { slug: eventSlug } });
  if (await prisma.application.findFirst({ where: { eventId: target.id, vendorProfileId } })) return null;
  const { preferredLabels = [], daysAgo = 1, ...rest } = data;
  const preferred = await prisma.slot.findMany({ where: { eventId: target.id, label: { in: preferredLabels } } });
  const submittedAt = new Date(Date.now() - daysAgo * 86_400_000);
  return prisma.application.create({
    data: {
      eventId: target.id,
      vendorProfileId,
      preferredSlots: { create: preferred.map((x) => ({ slotId: x.id })) },
      policyTextSnapshot: target.policyText ?? '',
      policyAcceptedAt: submittedAt,
      submittedAt,
      categories: { create: [{ categoryId }] },
      ...rest,
    },
  });
}

const tahi = await seedVendor('vendor2@creavent.test', 'Carla Dizon', 'Tahi-Tahi PH', 'tahi-tahi-ph', [crafts]);
const thrift = await seedVendor('vendor3@creavent.test', 'Ben Uy', 'Thrift Kingdom', 'thrift-kingdom', [preloved.id, vintage]);
await application(tahi.id, 'lanang-holiday-flea', crafts, { preferredLabels: ['B-03'], vendorNote: 'Near the entrance if possible.', daysAgo: 3 });
await application(thrift.id, 'lanang-holiday-flea', vintage, { status: 'withdrawn', withdrawnAt: new Date(), daysAgo: 4 });
const organizerUser = await prisma.user.findUniqueOrThrow({ where: { email: 'organizer@creavent.test' } });
const decided = { decidedById: organizerUser.id, decidedAt: new Date() };
const paper = await seedVendor('vendor4@creavent.test', 'Mia Santos', 'Paper Bayani', 'paper-bayani', [crafts]);
const tanim = await seedVendor('vendor5@creavent.test', 'Rafa Lim', 'Tanim Plant Co.', 'tanim-plant-co', [plants]);
await application(paper.id, 'lanang-holiday-flea', crafts, { status: 'approved', slotsRequested: 2, preferredLabels: ['A-05', 'A-06'], daysAgo: 6, ...decided });
await application(tanim.id, 'lanang-holiday-flea', plants, { status: 'declined', decisionNote: 'We have enough plant stalls this time.', daysAgo: 5, ...decided });

// An approved vendor with a slot, the payment in a given state. The ended
// states match what the app writes: released (the vendor let go of an unpaid
// slot), removed (the organizer removed the vendor), canceled (the event was
// canceled after the vendor paid). Their payments are archived. Pass
// assignedDaysAgo for an event in the past, so the dates line up.
type AssignmentState = 'waiting' | 'overdue' | 'reserved' | 'released' | 'removed' | 'canceled';
async function seedAssignment(
  vendorProfileId: string,
  categoryId: string,
  labels: string[],
  state: AssignmentState,
  eventSlug = 'lanang-holiday-flea',
  assignedDaysAgo?: number,
) {
  const hour = 3_600_000;
  const target = await prisma.event.findUniqueOrThrow({ where: { slug: eventSlug }, include: { organizerProfile: true } });
  const ownerId = target.organizerProfile.userId;
  const ended = state === 'released' || state === 'removed' || state === 'canceled';
  const paid = state === 'reserved' || state === 'canceled';
  const assignedAt = new Date(Date.now() - (assignedDaysAgo ?? 2) * 24 * hour);
  const app = await application(vendorProfileId, eventSlug, categoryId, {
    status: state === 'removed' ? 'removed' : 'approved',
    slotsRequested: labels.length,
    daysAgo: assignedDaysAgo === undefined ? 8 : assignedDaysAgo + 2,
    decidedById: ownerId,
    decidedAt: assignedDaysAgo === undefined ? new Date() : new Date(assignedAt.getTime() - 3 * hour),
    ...(state === 'removed'
      ? { removedAt: new Date(assignedAt.getTime() + 30 * hour), removedById: ownerId, removalNote: 'No payment by the deadline', canReapply: true }
      : {}),
  });
  if (!app) return;
  const slots = await prisma.slot.findMany({ where: { eventId: app.eventId, label: { in: labels } } });
  const ev = await prisma.event.findUniqueOrThrow({ where: { id: app.eventId }, include: { paymentMethods: true } });
  const prices = slots.map((x) => Number(x.price ?? ev.defaultSlotPrice ?? 0));
  const price = prices.reduce((sum, p) => sum + p, 0);
  const hours = state === 'overdue' ? -6 : 20;
  const vendorUser = await prisma.vendorProfile.findUniqueOrThrow({ where: { id: vendorProfileId } });
  const reservedAt = paid ? (assignedDaysAgo === undefined ? new Date() : new Date(assignedAt.getTime() + 5 * hour)) : null;
  const endedAt = ended ? new Date(assignedAt.getTime() + 30 * hour) : null;
  await prisma.slotAssignment.create({
    data: {
      slots: { create: slots.map((x, n) => ({ slotId: x.id, priceLocked: prices[n], active: !ended })) },
      eventId: app.eventId,
      applicationId: app.id,
      vendorProfileId,
      status: state === 'waiting' || state === 'overdue' ? 'assigned' : state,
      priceLocked: price,
      paymentInstructionsSnapshot: ev.paymentMethods.map((m) => ({
        id: m.id, channel: m.channel, label: m.label, accountName: m.accountName, accountNumber: m.accountNumber, qrFileId: m.qrFileId, notes: m.notes,
      })),
      assignedAt,
      assignedById: ownerId,
      deadlineAt: assignedDaysAgo === undefined ? new Date(Date.now() + hours * hour) : new Date(assignedAt.getTime() + 24 * hour),
      reservedAt,
      ...(ended
        ? {
            endedAt,
            endedById: state === 'released' ? vendorUser.userId : ownerId,
            endedReason: { released: 'Released by the vendor', removed: 'No payment by the deadline', canceled: 'Event canceled' }[state],
          }
        : {}),
      payment: {
        create: {
          eventId: app.eventId,
          payerUserId: vendorUser.userId,
          payeeUserId: ownerId,
          amountDue: price,
          status: paid ? 'approved' : 'pending',
          ...(paid ? { decidedById: ownerId, decidedAt: reservedAt, amountPaid: price } : {}),
          ...(ended ? { archivedAt: endedAt } : {}),
        },
      },
    },
  });
}
const habi = await seedVendor('vendor6@creavent.test', 'June Abad', 'Habi Mindanao', 'habi-mindanao', [crafts]);
const kalye = await seedVendor('vendor7@creavent.test', 'Paolo Cruz', 'Kalye Kicks', 'kalye-kicks', [preloved.id]);
const bulak = await seedVendor('vendor8@creavent.test', 'Nina Go', 'Bulak Studio', 'bulak-studio', [crafts]);
await seedAssignment(habi.id, crafts, ['A-01', 'A-02'], 'waiting');
await seedAssignment(bulak.id, crafts, ['A-03'], 'overdue');
await seedAssignment(kalye.id, preloved.id, ['B-04'], 'reserved');
const retro = await seedVendor('vendor9@creavent.test', 'Lito Ramos', 'Retro Laruan', 'retro-laruan', [crafts]);
await application(retro.id, 'lanang-holiday-flea', crafts, {
  status: 'removed',
  removedAt: new Date(),
  removedById: organizerUser.id,
  removalNote: 'No payment by the deadline',
  canReapply: false,
  daysAgo: 9,
  ...decided,
});

// Phase 4: public discovery. Dates count from today, so the listing always
// has events this weekend, next weekend, and later.
//   Matina Night Flea         organizer@, announced, this Saturday, 4 vendors
//                             confirmed and 1 still unpaid
//   Ukay Sunday sa People's Park  organizer2@ (Tiangge Davao), announced, Sunday
//   Pasalubong and Handmade Fair  organizer2@, announced bazaar, Fri to Sun next week
//   Plantita Pop-up           organizer2@, announced pop-up, in 3 weeks
//   Matina Night Flea, October  organizer@, completed, where Lola's Ukay sold
//   Toril Night Market        organizer@, canceled before it was announced
//   Kadayawan Rain Market     organizer2@, canceled after it was announced
const day = 86_400_000;
const manilaToday = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
const weekday = new Date(`${manilaToday}T00:00:00Z`).getUTCDay();
const fromToday = (days: number) => new Date(Date.parse(`${manilaToday}T00:00:00Z`) + days * day).toISOString().slice(0, 10);
const saturday = (weeks = 0) => fromToday(((6 - weekday + 7) % 7) + weeks * 7);
const plus = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * day).toISOString().slice(0, 10);
const announced = { status: 'announced' as const, openedToVendorsAt: new Date(Date.now() - 20 * day), announcedAt: new Date(Date.now() - 5 * day), applicationsOpen: false };
const gcash = { create: [{ channel: 'gcash' as const, label: 'GCash, Joanna L.', accountName: 'Joanna L.', accountNumber: '0928 115 7720', sortOrder: 0 }] };

await organizer('organizer2@creavent.test', 'Tiangge Davao', 'approved', 40);

await event('organizer@creavent.test', 'matina-night-flea', {
  name: 'Matina Night Flea',
  description: "Davao's after-work flea market is back at Matina Town Square. Stalls of ukay-ukay, vintage denim, local crafts, plants and street food, from sundown until 11.\n\nBring an eco bag and small bills. Most vendors also take GCash.",
  startsAt: at(saturday(), '17:00'),
  endsAt: at(saturday(), '23:00'),
  ...venue('Matina Town Square', 'MacArthur Highway, Matina'),
  vendorContactInfo: contact,
  policyText: policy,
  ...announced,
  defaultSlotPrice: 800,
  categories: { create: [{ categoryId: preloved.id, maxVendors: 12 }, { categoryId: crafts, maxVendors: 8 }, { categoryId: vintage, maxVendors: 6 }] },
  paymentMethods: gcash,
  slots: { create: [...row('A', 10, 'Main walkway', '2 × 2 m', 0), ...row('B', 6, 'Entrance', '3 × 3 m', 10, 1500)] },
});
await seedAssignment(profile.id, preloved.id, ['A-03'], 'reserved', 'matina-night-flea');
await seedAssignment(kalye.id, preloved.id, ['A-05'], 'reserved', 'matina-night-flea');
await seedAssignment(habi.id, crafts, ['B-01', 'B-02'], 'reserved', 'matina-night-flea');
await seedAssignment(paper.id, crafts, ['B-04'], 'reserved', 'matina-night-flea');
await seedAssignment(bulak.id, crafts, ['A-07'], 'waiting', 'matina-night-flea');

await event('organizer2@creavent.test', 'ukay-sunday-peoples-park', {
  name: "Ukay Sunday sa People's Park",
  description: 'Sunday morning ukay-ukay under the trees at People\'s Park.',
  startsAt: at(plus(saturday(), 1), '07:00'),
  endsAt: at(plus(saturday(), 1), '13:00'),
  ...venue("People's Park", 'Palma Gil Street, Poblacion'),
  vendorContactInfo: 'Text 0917 555 0142',
  policyText: policy,
  ...announced,
  defaultSlotPrice: 500,
  categories: { create: [{ categoryId: preloved.id, maxVendors: null }] },
  paymentMethods: gcash,
  slots: { create: row('P', 12, 'Park lane', '2 × 2 m', 0) },
});
await seedAssignment(thrift.id, preloved.id, ['P-02'], 'reserved', 'ukay-sunday-peoples-park');

await event(
  'organizer2@creavent.test',
  'pasalubong-and-handmade-fair',
  {
    name: 'Pasalubong and Handmade Fair',
    description: 'Three days of pasalubong, woven goods and handmade gifts from Mindanao makers.',
    startsAt: at(plus(saturday(1), -1), '09:00'),
    endsAt: at(plus(saturday(1), 1), '17:00'),
    ...venue('Rizal Park', 'San Pedro Street, Poblacion'),
    vendorContactInfo: 'Text 0917 555 0142',
    policyText: policy,
    ...announced,
    defaultSlotPrice: 1200,
    categories: { create: [{ categoryId: crafts, maxVendors: null }, { categoryId: food, maxVendors: 8 }] },
    paymentMethods: gcash,
    slots: { create: row('C', 20, 'Fair grounds', '3 × 3 m', 0) },
  },
  'bazaar',
);
await seedAssignment(tahi.id, crafts, ['C-07'], 'reserved', 'pasalubong-and-handmade-fair');

await event(
  'organizer2@creavent.test',
  'plantita-pop-up',
  {
    name: 'Plantita Pop-up',
    description: 'Succulents, herbs and clay pots for one day at Abreeza.',
    startsAt: at(saturday(3), '10:00'),
    endsAt: at(saturday(3), '20:00'),
    ...venue('Abreeza Mall', 'J.P. Laurel Avenue, Bajada'),
    vendorContactInfo: 'Text 0917 555 0142',
    policyText: policy,
    ...announced,
    defaultSlotPrice: 700,
    categories: { create: [{ categoryId: plants, maxVendors: null }] },
    paymentMethods: gcash,
    slots: { create: row('G', 8, 'Garden court', '2 × 2 m', 0) },
  },
  'pop-up',
);

await event('organizer@creavent.test', 'matina-night-flea-october', {
  name: 'Matina Night Flea, October',
  description: 'Our October night market.',
  startsAt: at('2026-10-17', '17:00'),
  endsAt: at('2026-10-17', '23:00'),
  ...venue('Matina Town Square', 'MacArthur Highway, Matina'),
  vendorContactInfo: contact,
  policyText: policy,
  ...announced,
  status: 'completed',
  completedAt: new Date('2026-10-17T16:00:00Z'),
  defaultSlotPrice: 800,
  categories: { create: [{ categoryId: preloved.id, maxVendors: 12 }] },
  paymentMethods: gcash,
  slots: { create: row('A', 10, 'Main walkway', '2 × 2 m', 0) },
});
await seedAssignment(profile.id, preloved.id, ['A-03'], 'reserved', 'matina-night-flea-october');

await event('organizer@creavent.test', 'toril-night-market', {
  name: 'Toril Night Market',
  description: 'A Friday night market in Toril.',
  startsAt: at(plus(saturday(2), -1), '17:00'),
  endsAt: at(plus(saturday(2), -1), '23:00'),
  ...venue('Toril Public Market', 'Saavedra Street, Toril'),
  vendorContactInfo: contact,
  policyText: policy,
  status: 'canceled',
  openedToVendorsAt: new Date(Date.now() - 10 * day),
  canceledAt: new Date(Date.now() - day),
  cancelReason: 'The venue is under repair that week.',
  defaultSlotPrice: 600,
  categories: { create: [{ categoryId: preloved.id, maxVendors: null }] },
  paymentMethods: gcash,
  slots: { create: row('T', 10, 'Market lane', '2 × 2 m', 0) },
});

await event('organizer2@creavent.test', 'kadayawan-rain-market', {
  name: 'Kadayawan Rain Market',
  description: 'An evening market at the covered court.',
  startsAt: at(saturday(2), '16:00'),
  endsAt: at(saturday(2), '22:00'),
  ...venue('Bajada Covered Court', 'J.P. Laurel Avenue, Bajada'),
  vendorContactInfo: 'Text 0917 555 0142',
  policyText: policy,
  ...announced,
  status: 'canceled',
  canceledAt: new Date(Date.now() - day),
  cancelReason: 'Typhoon signal 2 is expected over Davao that weekend.',
  defaultSlotPrice: 600,
  categories: { create: [{ categoryId: preloved.id, maxVendors: null }] },
  paymentMethods: gcash,
  slots: { create: row('K', 10, 'Court', '2 × 2 m', 0) },
});

// ─── A populated platform ────────────────────────────────────────────────────
// More organizers, vendors and events, so lists, filters, dashboards and the
// public pages have something to show. Dates count from today, like Phase 4.
//
// Organizers (approved unless noted), each with their own city and payment:
//   organizer3@ Davao Makers Collective   organizer4@ Digos Night Bazaar
//   organizer5@ Tagum Weekend Market      organizer6@ Buhangin Green Market
//   pending3@ Panabo Craft Circle, pending4@ Catalunan Flea Crew  waiting for review
//   rejected2@ Quick Cash Sale            rejected
//   suspended@ Marfori Pop-ups            approved, then suspended by the admin
// Vendors: vendor10@ to vendor31@ (22 shops across every category), and
//   vendor32@ Replika Outlet, suspended.
// Events by status: completed (7 in the past, up to 12 weeks back), announced
// (4 in the next 3 weeks, partly filled), open to vendors (5, with applications
// in each state), draft (3), canceled after announcing (with refunds due) and one
// hidden by the admin. Seeded payments are pending or approved, never "submitted":
// a submitted payment needs a proof image, and seeded rows have no files.
const bios: Record<string, { description: string; products: string; city: string }> = {
  'tahi-tahi-ph': { description: 'Screen-printed tote bags and tees with Bisaya wordplay.', products: 'Tote bags, shirts, enamel pins', city: 'Davao City' },
  'thrift-kingdom': { description: 'Branded thrift and 90s streetwear, sorted by size.', products: 'Jackets, jeans, vintage tees', city: 'Davao City' },
  'paper-bayani': { description: 'Planners, journals and cards made from recycled paper.', products: 'Journals, greeting cards, stickers', city: 'Davao City' },
  'tanim-plant-co': { description: 'Succulents, herbs and air plants in hand-painted pots.', products: 'Succulents, herbs, pots', city: 'Davao City' },
  'habi-mindanao': { description: 'Woven bags and runners from T\'boli and Mandaya weavers.', products: 'Woven bags, table runners, accessories', city: 'Davao City' },
  'kalye-kicks': { description: 'Authentic preloved sneakers, cleaned and sized.', products: 'Sneakers, caps', city: 'Davao City' },
  'bulak-studio': { description: 'Dried flower arrangements and pressed-flower frames.', products: 'Dried flowers, frames, bouquets', city: 'Davao City' },
  'retro-laruan': { description: 'Collectible toys and retro games.', products: 'Die-cast cars, toys', city: 'Davao City' },
  'lolas-ukay': { description: 'Hand-picked preloved tops and denim.', products: 'Tops, denim, dresses', city: 'Davao City' },
};
for (const [slug, bio] of Object.entries(bios)) {
  await prisma.vendorProfile.updateMany({ where: { slug, description: null }, data: bio });
}
const [books, other] = await Promise.all(['books-and-toys', 'other'].map(category));
const fb = (slug: string) => [`https://facebook.com/${slug}`];
const ig = (slug: string) => [`https://facebook.com/${slug}`, `https://instagram.com/${slug}`];

await organizer('organizer3@creavent.test', 'Davao Makers Collective', 'approved', 75, {
  about: 'A collective of Davao makers running curated craft markets since 2023.',
  ownerName: 'Bea Cortes',
  phone: '+639175550101',
});
await organizer('organizer4@creavent.test', 'Digos Night Bazaar', 'approved', 60, {
  city: 'Digos City',
  about: 'Friday and Saturday night bazaars at the Digos plaza, with live acoustic sets.',
  ownerName: 'Randy Monteza',
  phone: '+639175550102',
});
await organizer('organizer5@creavent.test', 'Tagum Weekend Market', 'approved', 50, {
  city: 'Tagum City',
  about: 'Weekend market for Davao del Norte makers and farmers.',
  ownerName: 'Cheche Valdez',
  phone: '+639175550103',
});
await organizer('organizer6@creavent.test', 'Buhangin Green Market', 'approved', 45, {
  about: 'Plants, zero-waste goods and slow food, every other Sunday in Buhangin.',
  ownerName: 'Ian Pelayo',
  phone: '+639175550104',
});
await organizer('pending3@creavent.test', 'Panabo Craft Circle', 'pending_review', 2, { city: 'Panabo City', about: 'Craft nights for Panabo makers.', ownerName: 'Tina Gonzaga' });
await organizer('pending4@creavent.test', 'Catalunan Flea Crew', 'pending_review', 6, { about: 'Neighborhood flea market, new this year.', ownerName: 'Ronnel Abad' });
await organizer('rejected2@creavent.test', 'Quick Cash Sale', 'rejected', 8, { about: 'Big sale events.', ownerName: 'Anon Seller' });
await organizer('suspended@creavent.test', 'Marfori Pop-ups', 'approved', 70, { about: 'Pop-up shops around Davao.', ownerName: 'Eli Marfori' });
const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@creavent.test' } });
await prisma.userRole.updateMany({
  where: { user: { email: 'suspended@creavent.test' }, role: 'organizer', suspendedAt: null },
  data: { suspendedAt: new Date(Date.now() - 4 * day), suspendedById: adminUser.id, suspensionReason: 'Reports of an event that listed goods the organizer does not sell' },
});

const shops: Array<[string, string, string, string, string[], { description: string; products: string; city: string }]> = [
  ['sulyap', 'Grace Tan', 'Sulyap Vintage', 'sulyap-vintage', [vintage], { description: 'Vintage cameras, vinyl sleeves and 70s-80s homeware.', products: 'Film cameras, homeware, posters', city: 'Davao City' }],
  ['kape', 'Jomar Villanueva', 'Kape Kalinaw', 'kape-kalinaw', [food], { description: 'Single-origin Mindanao coffee, brewed on the spot.', products: 'Hot and iced coffee, beans', city: 'Davao City' }],
  ['puto', 'Maricel Ocampo', 'Puto Maya ni Nanay', 'puto-maya-ni-nanay', [food], { description: 'Puto maya with sikwate and fresh mango, made before sunrise.', products: 'Puto maya, sikwate, bibingka', city: 'Davao City' }],
  ['durian', 'Dindo Pacaña', 'Durian Delights', 'durian-delights', [food], { description: 'Durian candy, ice cream and pastillas from Calinan farms.', products: 'Durian candy, ice cream, pastillas', city: 'Davao City' }],
  ['cactus', 'Andrea Flores', 'Cactus Corner', 'cactus-corner', [plants], { description: 'Cacti and succulents grown in Marilog.', products: 'Cacti, succulents, terrariums', city: 'Davao City' }],
  ['pages', 'Kiko Mendoza', 'Pinoy Pages', 'pinoy-pages', [books], { description: 'Secondhand novels, komiks and textbooks, priced per pile.', products: 'Novels, komiks, textbooks', city: 'Davao City' }],
  ['laruan', 'Trisha Lacson', 'Laruan ni Lolo', 'laruan-ni-lolo', [books, crafts], { description: 'Wooden toys and puzzles carved in Calinan.', products: 'Wooden toys, puzzles, pull cars', city: 'Davao City' }],
  ['hablon', 'Sheena Magno', 'Hablon House', 'hablon-house', [crafts], { description: 'Hand-woven hablon scarves, pouches and bags.', products: 'Scarves, pouches, bags', city: 'Tagum City' }],
  ['bakal', 'Rey Balbuena', 'Bakal Bayani', 'bakal-bayani', [crafts, other], { description: 'Wall art and keychains from scrap metal.', products: 'Metal art, keychains, bottle openers', city: 'Davao City' }],
  ['denim', 'Faye Navarro', 'Denim Diaries', 'denim-diaries', [preloved.id, vintage], { description: 'Reworked and preloved denim, jackets and skirts.', products: 'Jeans, jackets, skirts', city: 'Davao City' }],
  ['marco', 'Marco Dela Cruz', 'Ukay ni Marco', 'ukay-ni-marco', [preloved.id], { description: 'Bale-fresh ukay, priced P50 to P250.', products: 'Shirts, dresses, shorts', city: 'Digos City' }],
  ['tablea', 'Lorna Sabellano', 'Tsokolate Tablea Co.', 'tsokolate-tablea-co', [food], { description: 'Tablea from cacao grown in Davao, plus champorado mix.', products: 'Tablea, champorado mix, cacao nibs', city: 'Davao City' }],
  ['bloom', 'Pia Bautista', 'Bloom and Bark', 'bloom-and-bark', [plants, crafts], { description: 'Handmade macrame planters and starter plants.', products: 'Planters, pothos, snake plants', city: 'Davao City' }],
  ['sticker', 'Jun Aquino', 'Sticker Sari-Sari', 'sticker-sari-sari', [other], { description: 'Vinyl stickers, risograph prints and postcards by local artists.', products: 'Stickers, prints, postcards', city: 'Davao City' }],
  ['herbs', 'Tess Hernandez', 'Binhi Herbs', 'binhi-herbs', [plants], { description: 'Herb seedlings, native vegetables and heirloom seeds.', products: 'Herb seedlings, seeds, compost', city: 'Tagum City' }],
  ['sneaker', 'Mark Llanos', 'Sneaker Swap Davao', 'sneaker-swap-davao', [preloved.id], { description: 'Buy, sell, swap: authentic preloved kicks.', products: 'Sneakers, socks, cleaning kits', city: 'Davao City' }],
  ['kandila', 'Irene Castro', 'Kandila Candle Lab', 'kandila-candle-lab', [crafts], { description: 'Soy candles scented with local calamansi, ylang-ylang and coffee.', products: 'Candles, wax melts', city: 'Davao City' }],
  ['vinyl', 'Noel Pagaduan', 'Retro Vinyl PH', 'retro-vinyl-ph', [vintage, other], { description: 'OPM and city-pop vinyl, cassettes and turntables.', products: 'Records, cassettes, turntables', city: 'Davao City' }],
  ['baked', 'Yna Soriano', 'Baked by Yna', 'baked-by-yna', [food], { description: 'Ube cheese pandesal, cookies and brownies baked fresh.', products: 'Pandesal, cookies, brownies', city: 'Digos City' }],
  ['beads', 'Carlo Ibarra', 'Mindanao Beads', 'mindanao-beads', [crafts], { description: 'Beaded earrings and necklaces in Mindanao patterns.', products: 'Earrings, necklaces, bracelets', city: 'Davao City' }],
  ['liza', 'Liza Ferrer', 'Thrift by Liza', 'thrift-by-liza', [preloved.id], { description: 'Women\'s tops and dresses, washed and pressed.', products: 'Tops, dresses, skirts', city: 'Davao City' }],
  ['mugs', 'Gabby Roxas', 'Mura Mugs', 'mura-mugs', [crafts], { description: 'Wheel-thrown ceramic mugs, bowls and small planters.', products: 'Mugs, bowls, planters', city: 'Davao City' }],
  ['replika', 'Dex Lim', 'Replika Outlet', 'replika-outlet', [preloved.id], { description: 'Branded bags and shoes.', products: 'Bags, shoes', city: 'Davao City' }],
];
const v: Record<string, Awaited<ReturnType<typeof seedVendor>>> = {};
for (const [n, [key, name, shop, slug, cats, bio]] of shops.entries()) {
  const phone = `+63918${String(5550200 + n).padStart(7, '0')}`;
  v[key] = await seedVendor(`vendor${10 + n}@creavent.test`, name, shop, slug, cats, { ...bio, phone, socialLinks: n % 3 === 0 ? ig(slug) : fb(slug) });
}
await prisma.userRole.updateMany({
  where: { user: { email: 'vendor32@creavent.test' }, role: 'vendor', suspendedAt: null },
  data: { suspendedAt: new Date(Date.now() - 6 * day), suspendedById: adminUser.id, suspensionReason: 'Selling counterfeit goods' },
});

// Slots are booked in order from `start`, one label per slot, so a vendor with
// two slots gets two neighbours.
const labelsFrom = (prefix: string, start: number, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix}-${String(start + i).padStart(2, '0')}`);
type Booking = [vendor: { id: string }, categoryId: string, count: number, state?: AssignmentState];
async function book(eventSlug: string, prefix: string, start: number, assignedDaysAgo: number, bookings: Booking[]) {
  let next = start;
  for (const [vendorProfile, categoryId, count, state = 'reserved'] of bookings) {
    await seedAssignment(vendorProfile.id, categoryId, labelsFrom(prefix, next, count), state, eventSlug, state === 'waiting' || state === 'overdue' ? undefined : assignedDaysAgo);
    next += count;
  }
}

// Applications at an event, in the state the organizer would see them.
type Kind = 'submitted' | 'approved' | 'declined' | 'withdrawn';
type Applicant = [vendor: { id: string }, categoryId: string, kind: Kind, extra?: { preferred?: string[]; note?: string; decision?: string; slots?: number }];
async function applications(eventSlug: string, list: Applicant[]) {
  const target = await prisma.event.findUniqueOrThrow({ where: { slug: eventSlug }, include: { organizerProfile: true } });
  const owner = { decidedById: target.organizerProfile.userId, decidedAt: new Date(Date.now() - day) };
  for (const [n, [vendorProfile, categoryId, kind, extra = {}]] of list.entries()) {
    await application(vendorProfile.id, eventSlug, categoryId, {
      preferredLabels: extra.preferred,
      vendorNote: extra.note,
      slotsRequested: extra.slots ?? 1,
      daysAgo: (n * 2) % 7 + 1,
      ...(kind === 'submitted' ? {} : kind === 'withdrawn' ? { status: 'withdrawn', withdrawnAt: new Date(Date.now() - day) } : { status: kind, ...owner }),
      ...(kind === 'declined' ? { decisionNote: extra.decision ?? 'Thank you for applying. We have enough stalls in your category.' } : {}),
    });
  }
}

// Past markets, most recent first. Completed events keep their bookings, so
// vendor pages show where each shop has sold.
const finished = {
  ...announced,
  status: 'completed' as const,
  openedToVendorsAt: new Date(Date.now() - 70 * day),
  announcedAt: new Date(Date.now() - 55 * day),
};
const sunday = (weeks: number) => plus(saturday(weeks), 1);
const past = (date: string, startTime = '17:00') => ({
  startsAt: at(date, startTime),
  endsAt: at(date, '22:00'),
  completedAt: at(date, '22:00'),
});

await event('organizer6@creavent.test', 'buhangin-green-market-october', {
  name: 'Buhangin Green Market, October',
  description: 'Plants, zero-waste goods and slow food on the plaza.',
  ...finished,
  startsAt: at(sunday(-2), '08:00'),
  endsAt: at(sunday(-2), '14:00'),
  completedAt: at(sunday(-2), '14:00'),
  ...venue('Buhangin Plaza', 'Buhangin Proper'),
  vendorContactInfo: 'Ian Pelayo · 0917 555 0104',
  policyText: policy,
  defaultSlotPrice: 450,
  categories: { create: [{ categoryId: plants, maxVendors: 8 }, { categoryId: crafts, maxVendors: 4 }, { categoryId: food, maxVendors: 3 }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Ian P.', accountName: 'Ian P.', accountNumber: '0917 555 0104', sortOrder: 0 }] },
  slots: { create: row('G', 10, 'Plaza', '2 × 2 m', 0) },
});
await book('buhangin-green-market-october', 'G', 1, 12, [[v.cactus, plants, 1], [v.herbs, plants, 1], [v.bloom, plants, 2], [tanim, plants, 1], [v.mugs, crafts, 1]]);

await event('organizer2@creavent.test', 'ukay-sunday-october', {
  name: "Ukay Sunday sa People's Park, October",
  description: 'Sunday morning ukay-ukay under the trees at People\'s Park.',
  ...finished,
  startsAt: at(sunday(-3), '07:00'),
  endsAt: at(sunday(-3), '13:00'),
  completedAt: at(sunday(-3), '13:00'),
  ...venue("People's Park", 'Palma Gil Street, Poblacion'),
  vendorContactInfo: 'Text 0917 555 0142',
  policyText: policy,
  defaultSlotPrice: 500,
  categories: { create: [{ categoryId: preloved.id, maxVendors: null }] },
  paymentMethods: gcash,
  slots: { create: row('P', 12, 'Park lane', '2 × 2 m', 0) },
});
await book('ukay-sunday-october', 'P', 1, 20, [[thrift, preloved.id, 1], [v.marco, preloved.id, 1], [v.liza, preloved.id, 1], [v.denim, preloved.id, 1], [kalye, preloved.id, 1], [v.sneaker, preloved.id, 1], [profile, preloved.id, 1], [v.sulyap, vintage, 1]]);

await event('organizer4@creavent.test', 'digos-night-bazaar-october', {
  name: 'Digos Night Bazaar, October',
  description: 'Food, ukay and crafts around the Digos plaza, with an acoustic stage.',
  ...finished,
  ...past(saturday(-4)),
  ...venue('Digos City Plaza', 'Rizal Avenue, Zone 2', 'Digos City', 'Davao del Sur'),
  vendorContactInfo: 'Randy Monteza · 0917 555 0102',
  policyText: policy,
  defaultSlotPrice: 600,
  categories: { create: [{ categoryId: food, maxVendors: 8 }, { categoryId: preloved.id, maxVendors: 6 }, { categoryId: plants, maxVendors: 3 }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Randy M.', accountName: 'Randy M.', accountNumber: '0917 555 0102', sortOrder: 0 }] },
  slots: { create: row('D', 14, 'Plaza ring', '2 × 2 m', 0) },
});
await book('digos-night-bazaar-october', 'D', 1, 26, [[v.kape, food, 1], [v.puto, food, 1], [v.tablea, food, 1], [v.baked, food, 1], [v.durian, food, 1], [v.marco, preloved.id, 1], [v.liza, preloved.id, 1], [v.denim, preloved.id, 1], [v.sneaker, preloved.id, 1], [v.cactus, plants, 1], [v.herbs, plants, 1]]);

await event('organizer3@creavent.test', 'davao-makers-market-october', {
  name: 'Davao Makers Market, October',
  description: 'Our monthly curated craft market: 40 makers, one hall.',
  ...finished,
  ...past(saturday(-5), '10:00'),
  endsAt: at(saturday(-5), '19:00'),
  completedAt: at(saturday(-5), '19:00'),
  ...venue('Ecoland Trade Hall', 'Ecoland Drive, Matina'),
  vendorContactInfo: 'Bea Cortes · 0917 555 0101',
  policyText: policy,
  defaultSlotPrice: 900,
  categories: { create: [{ categoryId: crafts, maxVendors: 20 }, { categoryId: food, maxVendors: 6 }, { categoryId: plants, maxVendors: 4 }, { categoryId: other, maxVendors: 4 }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Davao Makers', accountName: 'Bea C.', accountNumber: '0917 555 0101', sortOrder: 0 }, { channel: 'maya', label: 'Maya, Davao Makers', accountName: 'Bea C.', accountNumber: '0917 555 0101', sortOrder: 1 }] },
  slots: { create: row('M', 16, 'Hall floor', '2 × 2 m', 0) },
});
await book('davao-makers-market-october', 'M', 1, 33, [[habi, crafts, 1], [paper, crafts, 1], [tahi, crafts, 1], [v.hablon, crafts, 1], [v.mugs, crafts, 1], [v.kandila, crafts, 1], [v.beads, crafts, 1], [v.bakal, crafts, 1], [v.sticker, other, 1], [v.bloom, plants, 1], [bulak, crafts, 1], [v.laruan, crafts, 1]]);

await event('organizer5@creavent.test', 'tagum-weekend-market-opening', {
  name: 'Tagum Weekend Market, Opening',
  description: 'The first Tagum Weekend Market: farmers, makers and food stalls at the city hall grounds.',
  ...finished,
  startsAt: at(saturday(-6), '08:00'),
  endsAt: at(sunday(-6), '18:00'),
  completedAt: at(sunday(-6), '18:00'),
  ...venue('Tagum City Hall Grounds', 'Mabini Street', 'Tagum City', 'Davao del Norte'),
  vendorContactInfo: 'Cheche Valdez · 0917 555 0103',
  policyText: policy,
  defaultSlotPrice: 700,
  categories: { create: [{ categoryId: food, maxVendors: null }, { categoryId: crafts, maxVendors: null }, { categoryId: plants, maxVendors: null }, { categoryId: books, maxVendors: 4 }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Cheche V.', accountName: 'Cheche V.', accountNumber: '0917 555 0103', sortOrder: 0 }] },
  slots: { create: row('T', 12, 'Grounds', '2 × 2 m', 0) },
});
await book('tagum-weekend-market-opening', 'T', 1, 38, [[v.kape, food, 1], [v.puto, food, 1], [v.pages, books, 1], [v.laruan, books, 1], [v.hablon, crafts, 1], [v.kandila, crafts, 1], [v.herbs, plants, 1], [v.cactus, plants, 1]]);

await event('organizer@creavent.test', 'matina-night-flea-september', {
  name: 'Matina Night Flea, September',
  description: 'Our September night market.',
  ...finished,
  ...past(saturday(-8)),
  endsAt: at(saturday(-8), '23:00'),
  completedAt: at(saturday(-8), '23:00'),
  ...venue('Matina Town Square', 'MacArthur Highway, Matina'),
  vendorContactInfo: contact,
  policyText: policy,
  defaultSlotPrice: 800,
  categories: { create: [{ categoryId: preloved.id, maxVendors: 12 }, { categoryId: vintage, maxVendors: 6 }, { categoryId: food, maxVendors: 6 }] },
  paymentMethods: gcash,
  slots: { create: [...row('A', 10, 'Main walkway', '2 × 2 m', 0), ...row('B', 6, 'Entrance', '3 × 3 m', 10, 1500)] },
});
await book('matina-night-flea-september', 'A', 1, 60, [[profile, preloved.id, 1], [kalye, preloved.id, 1], [v.denim, preloved.id, 1], [v.marco, preloved.id, 1], [v.liza, preloved.id, 1], [v.sulyap, vintage, 1], [v.sneaker, preloved.id, 1]]);
await book('matina-night-flea-september', 'B', 1, 60, [[v.kape, food, 1], [v.baked, food, 1], [v.puto, food, 2]]);

await event('organizer3@creavent.test', 'kadayawan-makers-fair', {
  name: 'Kadayawan Makers Fair',
  description: 'Two days of Mindanao makers during Kadayawan: weaving, beadwork, ceramics and food.',
  ...finished,
  startsAt: at(saturday(-12), '10:00'),
  endsAt: at(plus(saturday(-12), 1), '20:00'),
  completedAt: at(plus(saturday(-12), 1), '20:00'),
  ...venue('Rizal Park', 'San Pedro Street, Poblacion'),
  vendorContactInfo: 'Bea Cortes · 0917 555 0101',
  policyText: policy,
  defaultSlotPrice: 1200,
  categories: { create: [{ categoryId: crafts, maxVendors: null }, { categoryId: food, maxVendors: 8 }, { categoryId: plants, maxVendors: 4 }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Davao Makers', accountName: 'Bea C.', accountNumber: '0917 555 0101', sortOrder: 0 }] },
  slots: { create: row('C', 20, 'Fair grounds', '3 × 3 m', 0) },
}, 'bazaar');
await book('kadayawan-makers-fair', 'C', 1, 80, [[v.hablon, crafts, 2], [v.bakal, crafts, 1], [v.beads, crafts, 1], [v.mugs, crafts, 1], [v.kandila, crafts, 1], [habi, crafts, 2], [paper, crafts, 1], [tahi, crafts, 1], [v.bloom, plants, 1], [v.sticker, crafts, 1], [v.tablea, food, 1], [v.durian, food, 1], [v.puto, food, 1], [v.baked, food, 1]]);

await event('suspended@creavent.test', 'marfori-pop-up-september', {
  name: 'Marfori Pop-up, September',
  description: 'A one-day pop-up shop.',
  ...finished,
  ...past(saturday(-9), '10:00'),
  ...venue('Gaisano Mall Annex', 'J.P. Laurel Avenue, Bajada'),
  vendorContactInfo: 'Text 0917 555 0188',
  policyText: policy,
  defaultSlotPrice: 700,
  categories: { create: [{ categoryId: vintage, maxVendors: null }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Eli M.', accountName: 'Eli M.', accountNumber: '0917 555 0188', sortOrder: 0 }] },
  slots: { create: row('Z', 6, 'Annex', '2 × 2 m', 0) },
}, 'pop-up');
await book('marfori-pop-up-september', 'Z', 1, 63, [[v.sulyap, vintage, 1], [v.vinyl, vintage, 1]]);

// This week and the next three: announced, partly or mostly filled.
await event('organizer3@creavent.test', 'davao-makers-market-november', {
  name: 'Davao Makers Market, November',
  description: 'Forty makers under one roof: woven goods, ceramics, candles, prints and coffee. Free entry, with a kids\' craft corner from 2 PM.',
  ...announced,
  startsAt: at(saturday(1), '10:00'),
  endsAt: at(saturday(1), '19:00'),
  ...venue('Ecoland Trade Hall', 'Ecoland Drive, Matina'),
  vendorContactInfo: 'Bea Cortes · 0917 555 0101',
  ingressInfo: 'From 7 AM, loading dock at the back',
  policyText: policy,
  defaultSlotPrice: 900,
  categories: { create: [{ categoryId: crafts, maxVendors: 20 }, { categoryId: food, maxVendors: 6 }, { categoryId: plants, maxVendors: 4 }, { categoryId: other, maxVendors: 4 }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Davao Makers', accountName: 'Bea C.', accountNumber: '0917 555 0101', sortOrder: 0 }, { channel: 'maya', label: 'Maya, Davao Makers', accountName: 'Bea C.', accountNumber: '0917 555 0101', sortOrder: 1 }] },
  slots: { create: row('M', 24, 'Hall floor', '2 × 2 m', 0) },
});
await book('davao-makers-market-november', 'M', 1, 9, [
  [habi, crafts, 2], [paper, crafts, 1], [tahi, crafts, 1], [v.hablon, crafts, 2], [v.mugs, crafts, 1], [v.kandila, crafts, 1], [v.beads, crafts, 1], [v.bakal, crafts, 1],
  [v.sticker, other, 1], [v.bloom, plants, 1], [v.laruan, crafts, 1], [bulak, crafts, 1], [v.tablea, food, 1], [v.baked, food, 1], [v.vinyl, other, 1],
  [v.durian, food, 1, 'waiting'], [v.cactus, plants, 1, 'waiting'], [v.puto, food, 1, 'overdue'],
]);

await event('organizer4@creavent.test', 'digos-night-bazaar-november', {
  name: 'Digos Night Bazaar, November',
  description: 'Back at the plaza: grilled everything, ukay-ukay, plants and an acoustic stage until 10.',
  ...announced,
  startsAt: at(saturday(2), '16:00'),
  endsAt: at(saturday(2), '22:00'),
  ...venue('Digos City Plaza', 'Rizal Avenue, Zone 2', 'Digos City', 'Davao del Sur'),
  vendorContactInfo: 'Randy Monteza · 0917 555 0102',
  policyText: policy,
  defaultSlotPrice: 600,
  categories: { create: [{ categoryId: food, maxVendors: 8 }, { categoryId: preloved.id, maxVendors: 6 }, { categoryId: plants, maxVendors: 3 }, { categoryId: crafts, maxVendors: 4 }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Randy M.', accountName: 'Randy M.', accountNumber: '0917 555 0102', sortOrder: 0 }, { channel: 'bank', label: 'Bank transfer, Randy Monteza', accountName: 'Randy Monteza', accountNumber: '0098 4412 77', notes: 'BDO savings', sortOrder: 1 }] },
  slots: { create: row('D', 18, 'Plaza ring', '2 × 2 m', 0) },
});
await book('digos-night-bazaar-november', 'D', 1, 7, [
  [v.kape, food, 1], [v.puto, food, 1], [v.tablea, food, 1], [v.baked, food, 1], [v.durian, food, 1], [v.marco, preloved.id, 1], [v.liza, preloved.id, 1],
  [v.sneaker, preloved.id, 1], [v.cactus, plants, 1], [v.herbs, plants, 1], [v.denim, preloved.id, 1], [v.sulyap, vintage, 1], [profile, preloved.id, 1, 'waiting'],
]);

await event('organizer5@creavent.test', 'tagum-weekend-market-november', {
  name: 'Tagum Weekend Market, November',
  description: 'Two days of farm produce, handmade goods and street food at the city hall grounds.',
  ...announced,
  startsAt: at(saturday(1), '08:00'),
  endsAt: at(sunday(1), '18:00'),
  ...venue('Tagum City Hall Grounds', 'Mabini Street', 'Tagum City', 'Davao del Norte'),
  vendorContactInfo: 'Cheche Valdez · 0917 555 0103',
  policyText: policy,
  defaultSlotPrice: 700,
  categories: { create: [{ categoryId: food, maxVendors: null }, { categoryId: crafts, maxVendors: null }, { categoryId: plants, maxVendors: null }, { categoryId: books, maxVendors: 4 }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Cheche V.', accountName: 'Cheche V.', accountNumber: '0917 555 0103', sortOrder: 0 }] },
  slots: { create: row('T', 20, 'Grounds', '2 × 2 m', 0) },
});
await book('tagum-weekend-market-november', 'T', 1, 8, [
  [v.pages, books, 1], [v.laruan, books, 1], [v.hablon, crafts, 1], [v.kandila, crafts, 1], [v.kape, food, 1], [v.puto, food, 1], [v.herbs, plants, 2], [v.bloom, plants, 1],
  [v.baked, food, 1, 'waiting'], [v.beads, crafts, 1, 'waiting'],
]);

await event('organizer6@creavent.test', 'buhangin-green-market-november', {
  name: 'Buhangin Green Market, November',
  description: 'Plants, refills and slow food on the plaza. Bring your own containers.',
  ...announced,
  startsAt: at(sunday(2), '08:00'),
  endsAt: at(sunday(2), '14:00'),
  ...venue('Buhangin Plaza', 'Buhangin Proper'),
  vendorContactInfo: 'Ian Pelayo · 0917 555 0104',
  policyText: policy,
  defaultSlotPrice: 450,
  categories: { create: [{ categoryId: plants, maxVendors: 8 }, { categoryId: crafts, maxVendors: 4 }, { categoryId: food, maxVendors: 3 }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Ian P.', accountName: 'Ian P.', accountNumber: '0917 555 0104', sortOrder: 0 }] },
  slots: { create: row('G', 14, 'Plaza', '2 × 2 m', 0) },
});
await book('buhangin-green-market-november', 'G', 1, 6, [[v.cactus, plants, 1], [v.herbs, plants, 1], [v.bloom, plants, 2], [tanim, plants, 1], [v.mugs, crafts, 1], [v.kandila, crafts, 1], [v.kape, food, 1], [v.hablon, crafts, 1, 'waiting']]);

// More vendors at the Phase 4 events, so those pages look lived in.
// A-03, A-05, A-07, B-01, B-02 and B-04 are taken above.
await book('matina-night-flea', 'A', 1, 6, [[v.marco, preloved.id, 2]]);
await book('matina-night-flea', 'A', 4, 6, [[v.denim, preloved.id, 1]]);
await book('matina-night-flea', 'A', 6, 6, [[v.sulyap, vintage, 1]]);
await book('matina-night-flea', 'A', 8, 6, [[v.liza, preloved.id, 1], [v.sneaker, preloved.id, 1, 'waiting']]);
await book('ukay-sunday-peoples-park', 'P', 1, 6, [[v.liza, preloved.id, 1]]);
await book('ukay-sunday-peoples-park', 'P', 3, 6, [[v.marco, preloved.id, 1], [v.denim, preloved.id, 1], [v.sneaker, preloved.id, 1], [profile, preloved.id, 1]]);
await book('pasalubong-and-handmade-fair', 'C', 1, 5, [[v.hablon, crafts, 2], [v.beads, crafts, 1], [v.kandila, crafts, 1], [v.mugs, crafts, 1], [v.bakal, crafts, 1]]);
await book('pasalubong-and-handmade-fair', 'C', 8, 5, [[v.tablea, food, 1], [v.baked, food, 1], [v.puto, food, 1], [v.durian, food, 1], [paper, crafts, 1, 'waiting']]);
await book('plantita-pop-up', 'G', 1, 4, [[v.cactus, plants, 1], [v.herbs, plants, 1], [v.bloom, plants, 2], [tanim, plants, 1]]);

// Open to vendors: applications in every state, for the organizer's queue.
await event('organizer2@creavent.test', 'tiangge-christmas-bazaar', {
  name: 'Tiangge Christmas Bazaar',
  description: 'The biggest Christmas bazaar in Poblacion: three nights of gifts, ukay, crafts and food. Vendors pick the slots they prefer and the organizer assigns them.',
  startsAt: at(plus(saturday(5), -1), '15:00'),
  endsAt: at(plus(saturday(5), 1), '23:00'),
  ...venue('Rizal Park', 'San Pedro Street, Poblacion'),
  vendorContactInfo: 'Text 0917 555 0142',
  applicationsCloseAt: at(plus(saturday(3), 5), '23:59'),
  policyText: policy,
  status: 'open_to_vendors',
  openedToVendorsAt: new Date(Date.now() - 6 * day),
  applicationsOpen: true,
  slotMode: 'vendor_preference',
  maxSlotsPerVendor: 2,
  defaultSlotPrice: 1500,
  categories: { create: [{ categoryId: preloved.id, maxVendors: 10 }, { categoryId: crafts, maxVendors: 10 }, { categoryId: vintage, maxVendors: 4 }, { categoryId: food, maxVendors: 8 }, { categoryId: plants, maxVendors: 3 }] },
  documents: { create: [{ name: 'Barangay business clearance', sortOrder: 0 }, { name: 'Sanitary permit', categoryId: food, sortOrder: 1 }] },
  paymentMethods: gcash,
  slots: { create: [...row('H', 20, 'Main hall', '3 × 3 m', 0), ...row('F', 8, 'Food row', '3 × 3 m', 20, 1800).map((s) => ({ ...s, note: 'With power' }))] },
}, 'bazaar');
await book('tiangge-christmas-bazaar', 'H', 1, 3, [[habi, crafts, 2], [paper, crafts, 1], [tahi, crafts, 1], [bulak, crafts, 1], [v.bakal, crafts, 1, 'waiting']]);
await applications('tiangge-christmas-bazaar', [
  [v.sulyap, vintage, 'submitted', { preferred: ['H-07'], note: 'Vintage cameras need a table near a wall.' }],
  [v.denim, preloved.id, 'submitted', { preferred: ['H-08'] }],
  [v.marco, preloved.id, 'submitted', { preferred: ['H-09', 'H-10'], slots: 2, note: 'I bring two racks, so I need neighbouring slots.' }],
  [v.liza, preloved.id, 'submitted', { preferred: ['H-11'] }],
  [v.sneaker, preloved.id, 'submitted', { preferred: ['H-12'] }],
  [v.hablon, crafts, 'submitted', { preferred: ['H-13', 'H-14'], slots: 2 }],
  [v.kandila, crafts, 'submitted', { preferred: ['H-15'] }],
  [v.beads, crafts, 'submitted', { preferred: ['H-16'] }],
  [v.mugs, crafts, 'submitted', { preferred: ['H-17'], note: 'Fragile goods, away from the entrance please.' }],
  [v.tablea, food, 'submitted', { preferred: ['F-01'] }],
  [v.baked, food, 'submitted', { preferred: ['F-02'] }],
  [v.durian, food, 'submitted', { preferred: ['F-03'] }],
  [v.puto, food, 'submitted', { preferred: ['F-04'] }],
  [v.kape, food, 'submitted', { preferred: ['F-05'], note: 'I need power for the espresso machine.' }],
  [v.cactus, plants, 'submitted', { preferred: ['H-18'] }],
  [profile, preloved.id, 'submitted', { preferred: ['H-19'], note: 'First time at this bazaar.' }],
  [kalye, preloved.id, 'approved', { preferred: ['H-20'] }],
  [thrift, preloved.id, 'approved'],
  [v.vinyl, vintage, 'declined', { decision: 'We are full on records, but please apply to our next event.' }],
  [v.herbs, plants, 'withdrawn'],
]);

await event('organizer3@creavent.test', 'makers-christmas-pop-up', {
  name: 'Makers Christmas Pop-up',
  description: 'A one-day pop-up of gift-ready crafts, ten days before Christmas.',
  startsAt: at(saturday(4), '10:00'),
  endsAt: at(saturday(4), '20:00'),
  ...venue('Abreeza Mall', 'J.P. Laurel Avenue, Bajada'),
  vendorContactInfo: 'Bea Cortes · 0917 555 0101',
  applicationsCloseAt: at(plus(saturday(3), 3), '23:59'),
  policyText: policy,
  status: 'open_to_vendors',
  openedToVendorsAt: new Date(Date.now() - 4 * day),
  applicationsOpen: true,
  defaultSlotPrice: 1000,
  categories: { create: [{ categoryId: crafts, maxVendors: 10 }, { categoryId: other, maxVendors: 2 }] },
  documents: { create: [{ name: 'Valid ID', sortOrder: 0 }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Davao Makers', accountName: 'Bea C.', accountNumber: '0917 555 0101', sortOrder: 0 }] },
  slots: { create: row('K', 12, 'Garden court', '2 × 2 m', 0) },
}, 'pop-up');
await book('makers-christmas-pop-up', 'K', 1, 2, [[habi, crafts, 1], [v.mugs, crafts, 1], [v.kandila, crafts, 1], [v.hablon, crafts, 1, 'waiting']]);
await applications('makers-christmas-pop-up', [
  [v.beads, crafts, 'approved'],
  [v.bakal, crafts, 'approved'],
  [paper, crafts, 'submitted', { note: 'Journals and a card-making corner.' }],
  [tahi, crafts, 'submitted'],
  [v.bloom, crafts, 'submitted'],
  [v.sticker, other, 'submitted'],
  [v.laruan, crafts, 'submitted'],
  [bulak, crafts, 'declined', { decision: 'We already have two floral stalls.' }],
  [v.vinyl, other, 'withdrawn'],
]);

await event('organizer5@creavent.test', 'tagum-pasko-market', {
  name: 'Tagum Pasko Market',
  description: 'Christmas market with parol makers, farm gifts and food, at the city hall grounds.',
  startsAt: at(saturday(3), '09:00'),
  endsAt: at(sunday(3), '20:00'),
  ...venue('Tagum City Hall Grounds', 'Mabini Street', 'Tagum City', 'Davao del Norte'),
  vendorContactInfo: 'Cheche Valdez · 0917 555 0103',
  applicationsCloseAt: at(plus(saturday(2), 4), '23:59'),
  policyText: policy,
  status: 'open_to_vendors',
  openedToVendorsAt: new Date(Date.now() - 9 * day),
  applicationsOpen: true,
  defaultSlotPrice: 800,
  categories: { create: [{ categoryId: food, maxVendors: 10 }, { categoryId: crafts, maxVendors: 10 }, { categoryId: plants, maxVendors: 4 }, { categoryId: books, maxVendors: 3 }] },
  documents: { create: [{ name: 'Barangay business clearance', sortOrder: 0 }, { name: 'Sanitary permit', categoryId: food, sortOrder: 1 }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Cheche V.', accountName: 'Cheche V.', accountNumber: '0917 555 0103', sortOrder: 0 }] },
  slots: { create: row('N', 16, 'Grounds', '2 × 2 m', 0) },
});
await book('tagum-pasko-market', 'N', 1, 4, [[v.durian, food, 1], [v.bloom, plants, 1, 'waiting']]);
await applications('tagum-pasko-market', [
  [v.hablon, crafts, 'approved'],
  [v.cactus, plants, 'approved'],
  [v.kape, food, 'submitted'],
  [v.puto, food, 'submitted'],
  [v.tablea, food, 'submitted'],
  [v.baked, food, 'submitted'],
  [v.pages, books, 'submitted'],
  [v.laruan, books, 'submitted', { slots: 1, note: 'Wooden toys, safe for kids.' }],
  [v.kandila, crafts, 'submitted'],
  [v.beads, crafts, 'submitted'],
  [v.mugs, crafts, 'declined', { decision: 'Our venue has no place for kilns or heavy goods this time.' }],
]);

await event('organizer4@creavent.test', 'digos-new-year-countdown', {
  name: 'Digos New Year Countdown Market',
  description: 'Food, party goods and a midnight countdown at the plaza.',
  startsAt: at('2026-12-31', '16:00'),
  endsAt: at('2026-12-31', '23:59'),
  ...venue('Digos City Plaza', 'Rizal Avenue, Zone 2', 'Digos City', 'Davao del Sur'),
  vendorContactInfo: 'Randy Monteza · 0917 555 0102',
  applicationsCloseAt: at('2026-12-20', '23:59'),
  policyText: policy,
  status: 'open_to_vendors',
  openedToVendorsAt: new Date(Date.now() - 2 * day),
  applicationsOpen: true,
  defaultSlotPrice: 900,
  categories: { create: [{ categoryId: food, maxVendors: 10 }, { categoryId: preloved.id, maxVendors: 6 }, { categoryId: other, maxVendors: 4 }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Randy M.', accountName: 'Randy M.', accountNumber: '0917 555 0102', sortOrder: 0 }] },
  slots: { create: row('D', 20, 'Plaza ring', '2 × 2 m', 0) },
});
await book('digos-new-year-countdown', 'D', 1, 1, [[v.sulyap, vintage, 1]]);
await applications('digos-new-year-countdown', [
  [v.liza, preloved.id, 'approved'],
  [v.puto, food, 'submitted'],
  [v.kape, food, 'submitted'],
  [v.tablea, food, 'submitted'],
  [v.durian, food, 'submitted'],
  [v.baked, food, 'submitted'],
  [v.sneaker, preloved.id, 'submitted'],
  [v.denim, preloved.id, 'submitted'],
  [v.marco, preloved.id, 'declined', { decision: 'We have enough ukay stalls for this one.' }],
]);

// The Phase 3 events get a bigger queue and a few paid vendors.
await applications('lanang-holiday-flea', [
  [v.sulyap, vintage, 'submitted', { preferred: ['B-05'], note: 'Cameras and homeware, one table.' }],
  [v.denim, preloved.id, 'submitted', { preferred: ['B-06', 'B-07'], slots: 2 }],
  [v.liza, preloved.id, 'submitted', { preferred: ['A-08'] }],
  [v.hablon, crafts, 'submitted', { preferred: ['B-08'] }],
  [v.kandila, crafts, 'submitted', { preferred: ['A-09'] }],
  [v.tablea, food, 'submitted', { preferred: ['F-01'] }],
  [v.baked, food, 'submitted', { preferred: ['F-02'], note: 'I need an outlet for the oven.' }],
  [v.sneaker, preloved.id, 'approved', { preferred: ['B-09'] }],
]);
await book('lanang-holiday-flea', 'F', 3, 5, [[v.puto, food, 1], [v.kape, food, 1, 'waiting']]);
await book('bajada-christmas-flea', 'C', 1, 9, [[v.marco, preloved.id, 1], [v.liza, preloved.id, 1], [v.denim, preloved.id, 1], [v.sneaker, preloved.id, 1], [v.hablon, crafts, 1], [kalye, preloved.id, 1]]);

// Drafts at different stages.
await event('organizer3@creavent.test', 'valentines-heart-market', {
  name: "Valentine's Heart Market",
  description: 'A market of handmade gifts for February 14.',
  startsAt: at('2027-02-13', '10:00'),
  endsAt: at('2027-02-14', '19:00'),
});
await event('organizer5@creavent.test', 'tagum-toy-swap', {
  name: 'Tagum Toy Swap',
  description: 'Bring a toy, take a toy, buy secondhand books.',
  startsAt: at('2027-01-23', '09:00'),
  endsAt: at('2027-01-23', '15:00'),
  ...venue('Tagum City Library', 'Rizal Street', 'Tagum City', 'Davao del Norte'),
  vendorContactInfo: 'Cheche Valdez · 0917 555 0103',
  defaultSlotPrice: 300,
  categories: { create: [{ categoryId: books, maxVendors: null }] },
});
await event('organizer6@creavent.test', 'buhangin-summer-plant-sale', {
  name: 'Buhangin Summer Plant Sale',
  description: 'Seedlings, pots and soil mixes before the dry season.',
  startsAt: at('2027-03-07', '08:00'),
  endsAt: at('2027-03-07', '14:00'),
  ...venue('Buhangin Plaza', 'Buhangin Proper'),
  vendorContactInfo: 'Ian Pelayo · 0917 555 0104',
  policyText: policy,
  defaultSlotPrice: 450,
  categories: { create: [{ categoryId: plants, maxVendors: 10 }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Ian P.', accountName: 'Ian P.', accountNumber: '0917 555 0104', sortOrder: 0 }] },
  slots: { create: row('G', 12, 'Plaza', '2 × 2 m', 0) },
});
await event('pending4@creavent.test', 'catalunan-weekend-flea', {
  name: 'Catalunan Weekend Flea',
  description: 'A neighborhood flea market at the barangay hall, new this year.',
  startsAt: at('2027-02-20', '08:00'),
  endsAt: at('2027-02-21', '17:00'),
  ...venue('Catalunan Grande Barangay Hall', 'Catalunan Grande'),
  vendorContactInfo: 'Text 0917 555 0166',
  policyText: policy,
  defaultSlotPrice: 400,
  categories: { create: [{ categoryId: preloved.id, maxVendors: null }, { categoryId: food, maxVendors: 6 }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Ronnel A.', accountName: 'Ronnel A.', accountNumber: '0917 555 0166', sortOrder: 0 }] },
  slots: { create: row('F', 14, 'Barangay hall', '2 × 2 m', 0) },
});

// Canceled after announcing: paid vendors are refunded, others were let go.
await event('organizer4@creavent.test', 'digos-rainy-night-market', {
  name: 'Digos Rainy Night Market',
  description: 'A night market at the plaza.',
  ...announced,
  status: 'canceled',
  startsAt: at(plus(saturday(0), -1), '16:00'),
  endsAt: at(plus(saturday(0), -1), '22:00'),
  ...venue('Digos City Plaza', 'Rizal Avenue, Zone 2', 'Digos City', 'Davao del Sur'),
  vendorContactInfo: 'Randy Monteza · 0917 555 0102',
  policyText: policy,
  canceledAt: new Date(Date.now() - 2 * day),
  cancelReason: 'The city issued a flood warning for the plaza this week.',
  defaultSlotPrice: 600,
  categories: { create: [{ categoryId: food, maxVendors: 8 }, { categoryId: preloved.id, maxVendors: 6 }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Randy M.', accountName: 'Randy M.', accountNumber: '0917 555 0102', sortOrder: 0 }] },
  slots: { create: row('R', 10, 'Plaza ring', '2 × 2 m', 0) },
});
await book('digos-rainy-night-market', 'R', 1, 6, [[v.kape, food, 1, 'canceled'], [v.puto, food, 1, 'canceled'], [v.marco, preloved.id, 1, 'canceled'], [v.baked, food, 1, 'canceled'], [v.tablea, food, 1, 'released'], [v.durian, food, 1, 'removed']]);

// Hidden by the admin, with its organizer suspended: no public page.
await event('suspended@creavent.test', 'marfori-mega-sale', {
  name: 'Mega Sale: Branded Everything',
  description: 'Branded bags and shoes at 90% off.',
  ...announced,
  startsAt: at(saturday(3), '10:00'),
  endsAt: at(saturday(3), '20:00'),
  ...venue('Gaisano Mall Annex', 'J.P. Laurel Avenue, Bajada'),
  vendorContactInfo: 'Text 0917 555 0188',
  policyText: policy,
  moderationState: 'hidden',
  moderatedAt: new Date(Date.now() - 4 * day),
  moderatedById: adminUser.id,
  moderationReason: 'Listing promises branded goods at prices that suggest counterfeits',
  defaultSlotPrice: 700,
  categories: { create: [{ categoryId: preloved.id, maxVendors: null }] },
  paymentMethods: { create: [{ channel: 'gcash', label: 'GCash, Eli M.', accountName: 'Eli M.', accountNumber: '0917 555 0188', sortOrder: 0 }] },
  slots: { create: row('Z', 8, 'Annex', '2 × 2 m', 0) },
}, 'pop-up');
await book('marfori-mega-sale', 'Z', 1, 9, [[v.replika, preloved.id, 2, 'reserved']]);

await prisma.$disconnect();
console.log(
  'Seeded. Accounts use SEED_PASSWORD: admin@, vendor@ to vendor32@, organizer@ to organizer6@, pending@ to pending4@, rejected@, rejected2@, later@, suspended@creavent.test',
);
