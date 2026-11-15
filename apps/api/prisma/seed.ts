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
//   Lanang Holiday Flea         open to vendors, vendors choose a preferred slot
//   Bajada Christmas Flea       open to vendors, applications closed
//   Mintal Weekend Bazaar       pending@'s ready draft, waiting for approval
//
// Applications (Phase 3), at Lanang Holiday Flea:
//   vendor2@ Tahi-Tahi PH    submitted, prefers B-03
//   vendor3@ Thrift Kingdom  withdrawn
//   vendor4@ Paper Bayani    approved, prefers A-05, no slot
//   vendor5@ Tanim Plant Co. declined with a note
//   vendor6@ Habi Mindanao   slot A-02, payment waiting
//   vendor7@ Kalye Kicks     slot B-04, reserved (payment approved)
//   vendor8@ Bulak Studio    slot A-03, payment overdue
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

async function organizer(email: string, displayName: string, status: ApprovalStatus, daysAgo: number) {
  const u = await user(email, `${displayName} Owner`, { phone: '+639171234567' });
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await prisma.organizerProfile.upsert({
    where: { userId: u.id },
    update: {},
    create: { userId: u.id, displayName, slug, city: 'Davao City', about: 'Monthly community market.', socialLinks: [`https://facebook.com/${slug}`] },
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
        ? { reviewedAt: new Date(Date.now() - (daysAgo - 1) * 86_400_000), reviewedLinks: [`https://facebook.com/${slug}`] }
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

async function event(email: string, slug: string, data: Omit<Prisma.EventUncheckedCreateInput, 'organizerProfileId' | 'eventTypeId' | 'slug'>) {
  if (await prisma.event.findUnique({ where: { slug } })) return;
  const owner = await prisma.organizerProfile.findFirstOrThrow({ where: { user: { email } } });
  const type = await prisma.eventType.findUniqueOrThrow({ where: { slug: 'flea-market' } });
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
const venue = (venueName: string, addressLine: string) => ({ venueName, addressLine, city: 'Davao City' });
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
      ...row('A', 16, 'Main walkway', '2 × 2 m', 0),
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
async function seedVendor(email: string, fullName: string, shopName: string, slug: string, categoryIds: string[]) {
  const u = await user(email, fullName, { phone: '+639181234567' });
  const p = await prisma.vendorProfile.upsert({
    where: { userId: u.id },
    update: {},
    create: { userId: u.id, shopName, slug, socialLinks: [], categories: { create: categoryIds.map((categoryId) => ({ categoryId })) } },
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
  data: Partial<Prisma.ApplicationUncheckedCreateInput> & { preferredLabel?: string; daysAgo?: number } = {},
) {
  const target = await prisma.event.findUniqueOrThrow({ where: { slug: eventSlug } });
  if (await prisma.application.findFirst({ where: { eventId: target.id, vendorProfileId } })) return null;
  const { preferredLabel, daysAgo = 1, ...rest } = data;
  const preferred = preferredLabel ? await prisma.slot.findFirst({ where: { eventId: target.id, label: preferredLabel } }) : null;
  const submittedAt = new Date(Date.now() - daysAgo * 86_400_000);
  return prisma.application.create({
    data: {
      eventId: target.id,
      vendorProfileId,
      preferredSlotId: preferred?.id ?? null,
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
await application(tahi.id, 'lanang-holiday-flea', crafts, { preferredLabel: 'B-03', vendorNote: 'Near the entrance if possible.', daysAgo: 3 });
await application(thrift.id, 'lanang-holiday-flea', vintage, { status: 'withdrawn', withdrawnAt: new Date(), daysAgo: 4 });
const organizerUser = await prisma.user.findUniqueOrThrow({ where: { email: 'organizer@creavent.test' } });
const decided = { decidedById: organizerUser.id, decidedAt: new Date() };
const paper = await seedVendor('vendor4@creavent.test', 'Mia Santos', 'Paper Bayani', 'paper-bayani', [crafts]);
const tanim = await seedVendor('vendor5@creavent.test', 'Rafa Lim', 'Tanim Plant Co.', 'tanim-plant-co', [plants]);
await application(paper.id, 'lanang-holiday-flea', crafts, { status: 'approved', preferredLabel: 'A-05', daysAgo: 6, ...decided });
await application(tanim.id, 'lanang-holiday-flea', plants, { status: 'declined', decisionNote: 'We have enough plant stalls this time.', daysAgo: 5, ...decided });

// An approved vendor with a slot, the payment in a given state.
async function seedAssignment(vendorProfileId: string, categoryId: string, label: string, state: 'waiting' | 'overdue' | 'reserved') {
  const app = await application(vendorProfileId, 'lanang-holiday-flea', categoryId, { status: 'approved', daysAgo: 8, ...decided });
  if (!app) return;
  const slot = await prisma.slot.findFirstOrThrow({ where: { eventId: app.eventId, label } });
  const ev = await prisma.event.findUniqueOrThrow({ where: { id: app.eventId }, include: { paymentMethods: true } });
  const price = Number(slot.price ?? ev.defaultSlotPrice ?? 0);
  const hours = state === 'overdue' ? -6 : 20;
  const vendorUser = await prisma.vendorProfile.findUniqueOrThrow({ where: { id: vendorProfileId } });
  await prisma.slotAssignment.create({
    data: {
      slotId: slot.id,
      eventId: app.eventId,
      applicationId: app.id,
      vendorProfileId,
      status: state === 'reserved' ? 'reserved' : 'assigned',
      priceLocked: price,
      paymentInstructionsSnapshot: ev.paymentMethods.map((m) => ({
        id: m.id, channel: m.channel, label: m.label, accountName: m.accountName, accountNumber: m.accountNumber, qrFileId: m.qrFileId, notes: m.notes,
      })),
      assignedAt: new Date(Date.now() - 2 * 86_400_000),
      assignedById: organizerUser.id,
      deadlineAt: new Date(Date.now() + hours * 3_600_000),
      reservedAt: state === 'reserved' ? new Date() : null,
      payment: {
        create: {
          eventId: app.eventId,
          payerUserId: vendorUser.userId,
          payeeUserId: organizerUser.id,
          amountDue: price,
          status: state === 'reserved' ? 'approved' : 'pending',
          ...(state === 'reserved' ? { decidedById: organizerUser.id, decidedAt: new Date(), amountPaid: price } : {}),
        },
      },
    },
  });
}
const habi = await seedVendor('vendor6@creavent.test', 'June Abad', 'Habi Mindanao', 'habi-mindanao', [crafts]);
const kalye = await seedVendor('vendor7@creavent.test', 'Paolo Cruz', 'Kalye Kicks', 'kalye-kicks', [preloved.id]);
const bulak = await seedVendor('vendor8@creavent.test', 'Nina Go', 'Bulak Studio', 'bulak-studio', [crafts]);
await seedAssignment(habi.id, crafts, 'A-02', 'waiting');
await seedAssignment(bulak.id, crafts, 'A-03', 'overdue');
await seedAssignment(kalye.id, preloved.id, 'B-04', 'reserved');

await prisma.$disconnect();
console.log(
  'Seeded. Accounts use SEED_PASSWORD: admin@, vendor@, organizer@, pending@, pending2@, rejected@, later@creavent.test',
);
