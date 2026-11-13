import type {
  ApprovalStatus,
  PrismaClient,
  RoleType,
} from '../../src/generated/prisma/client.js';

let counter = 0;

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
  return prisma.user.create({
    data: {
      email: `user${counter}@example.com`,
      fullName: `Test User ${counter}`,
      emailVerified: true,
      ageConfirmedAt: new Date(),
      ...overrides,
    },
  });
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
