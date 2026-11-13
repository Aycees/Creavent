// Seed data for local development and staging only (architecture §5.3): an
// admin, a vendor, and organizers in each approval state, so every Phase 1
// screen can be seen without clicking through signup. Run with
// `pnpm --filter @creavent/api db:seed` after a build. Safe to run again.
import { hashPassword } from 'better-auth/crypto';
import type { ApprovalStatus } from './generated/prisma/client.js';
import { PrismaService } from './prisma/prisma.service.js';

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

await organizer('approved@creavent.test', 'Matina Night Flea', 'approved', 10);
await organizer('pending@creavent.test', 'Bazaar ng Mintal', 'pending_review', 3);
await organizer('pending2@creavent.test', 'Lanang Holiday Flea', 'pending_review', 1);
await organizer('rejected@creavent.test', 'Bajada Ukay', 'rejected', 5);
await organizer('later@creavent.test', 'Toril Sunday Market', 'not_submitted', 0);

await prisma.$disconnect();
console.log('Seeded. Accounts use SEED_PASSWORD: admin@, vendor@, approved@, pending@, pending2@, rejected@, later@creavent.test');
