import type {
  ApprovalStatus,
  PrismaClient,
  RoleType,
} from '../../src/generated/prisma/client.js';

import { hashPassword } from 'better-auth/crypto';

// The password every factory user has, for signInAs().
export const TEST_PASSWORD = 'test-password-123';

let counter = 0;
let passwordHash: string | undefined;

// A verified user with no roles. Pass overrides for anything else.
export async function createUser(
  prisma: PrismaClient,
  overrides: Partial<{
    email: string;
    fullName: string;
    emailVerified: boolean;
    isAdmin: boolean;
    phone: string | null;
  }> = {},
) {
  counter += 1;
  passwordHash ??= await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.create({
    data: {
      email: `user${counter}@example.com`,
      fullName: `Test User ${counter}`,
      emailVerified: true,
      ageConfirmedAt: new Date(),
      ...overrides,
    },
  });
  // A password, so tests can sign in as this user with signInAs().
  await prisma.account.create({
    data: { userId: user.id, providerId: 'credential', accountId: user.id, password: passwordHash },
  });
  // Current agreements, so the user isn't sent to /account/legal.
  await prisma.legalAcceptance.createMany({
    data: [
      { userId: user.id, document: 'terms', version: '2026-11-12' },
      { userId: user.id, document: 'privacy', version: '2026-11-12' },
    ],
  });
  return user;
}

export async function addRole(
  prisma: PrismaClient,
  userId: string,
  role: RoleType,
  overrides: Partial<{
    approvalStatus: ApprovalStatus;
    onboardingStep: number;
    suspendedAt: Date;
  }> = {},
) {
  return prisma.userRole.create({
    data: {
      userId,
      role,
      approvalStatus: role === 'organizer' ? 'not_submitted' : null,
      ...overrides,
    },
  });
}
