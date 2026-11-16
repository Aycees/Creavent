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

// An approved vendor with a slot, the payment in a given state.
async function seedAssignment(
  vendorProfileId: string,
  categoryId: string,
  labels: string[],
  state: 'waiting' | 'overdue' | 'reserved',
  eventSlug = 'lanang-holiday-flea',
) {
  const app = await application(vendorProfileId, eventSlug, categoryId, { status: 'approved', slotsRequested: labels.length, daysAgo: 8, ...decided });
  if (!app) return;
  const slots = await prisma.slot.findMany({ where: { eventId: app.eventId, label: { in: labels } } });
  const ev = await prisma.event.findUniqueOrThrow({ where: { id: app.eventId }, include: { paymentMethods: true } });
  const prices = slots.map((x) => Number(x.price ?? ev.defaultSlotPrice ?? 0));
  const price = prices.reduce((sum, p) => sum + p, 0);
  const hours = state === 'overdue' ? -6 : 20;
  const vendorUser = await prisma.vendorProfile.findUniqueOrThrow({ where: { id: vendorProfileId } });
  await prisma.slotAssignment.create({
    data: {
      slots: { create: slots.map((x, n) => ({ slotId: x.id, priceLocked: prices[n], active: true })) },
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

await prisma.$disconnect();
console.log(
  'Seeded. Accounts use SEED_PASSWORD: admin@, vendor@, organizer@, pending@, pending2@, rejected@, later@creavent.test',
);
