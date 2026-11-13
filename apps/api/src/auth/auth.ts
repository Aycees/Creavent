import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { AppConfig } from '../config.js';
import type { OutboxService } from '../notifications/outbox.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { recordLegalAcceptance } from './legal.js';

const SIGN_UP_PATH = '/sign-up/email';

// Better Auth inside the API (docs/architecture.md §4.2). It owns sign-up,
// sign-in, Google, email verification, password reset, and sessions.
export function createAuth(prisma: PrismaService, outbox: OutboxService, config: AppConfig) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('BETTER_AUTH_SECRET is required in production');
  }

  const google =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {};

  async function queueAuthEmail(
    user: { id: string; email: string; name: string },
    type: 'email_verification' | 'password_reset',
    url: string,
  ) {
    await prisma.$transaction((tx) =>
      outbox.queue(tx, {
        userId: user.id,
        toEmail: user.email,
        type,
        payload: { name: user.name, url, supportEmail: config.supportEmail },
      }),
    );
  }

  return betterAuth({
    appName: 'Creavent',
    // The web origin: the browser reaches this API through its /api rewrite,
    // so links and cookies belong to the web app (architecture §4.3).
    baseURL: config.webUrl,
    basePath: '/api/auth',
    secret: secret ?? 'development-secret-change-me-at-least-32-chars',
    trustedOrigins: [config.webUrl],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    advanced: {
      database: { generateId: 'uuid' },
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
    user: {
      fields: { name: 'fullName' },
      additionalFields: {
        phone: { type: 'string', required: false, input: false },
        isAdmin: { type: 'boolean', required: false, input: false, defaultValue: false },
        ageConfirmedAt: { type: 'date', required: false, input: false },
        lastLoginAt: { type: 'date', required: false, input: false },
        deletedAt: { type: 'date', required: false, input: false },
        avatarFileId: { type: 'string', required: false, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await queueAuthEmail(user, 'password_reset', url);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 24 * 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await queueAuthEmail(user, 'email_verification', url);
      },
    },
    socialProviders: google,
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
        // Spec §1: Google sign-in opens an unverified account with the same
        // email, and the hook below removes its password. Better Auth marks
        // this option deprecated (architecture §4.2).
        requireLocalEmailVerified: false,
      },
    },
    rateLimit: {
      enabled: true,
      storage: 'memory',
      window: 60,
      max: 100,
      customRules: {
        // 5 failed tries, then a short lockout (architecture §4.1).
        '/sign-in/email': { window: 5 * 60, max: 5 },
        '/sign-up/email': { window: 60 * 60, max: 10 },
        '/request-password-reset': { window: 60 * 60, max: 5 },
        '/send-verification-email': { window: 60 * 60, max: 5 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SIGN_UP_PATH) return;
        const body = ctx.body as { ageConfirmed?: unknown; acceptLegal?: unknown } | undefined;
        if (body?.ageConfirmed !== true || body?.acceptLegal !== true) {
          throw new APIError('BAD_REQUEST', {
            message: 'Accept the terms of use and privacy notice, and confirm you are 18 or older',
          });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            if (ctx?.path !== SIGN_UP_PATH) return;
            return { data: { ...user, ageConfirmedAt: new Date() } };
          },
          after: async (user, ctx) => {
            if (ctx?.path !== SIGN_UP_PATH) return;
            await prisma.$transaction((tx) => recordLegalAcceptance(tx, user.id, config));
          },
        },
      },
      account: {
        create: {
          after: async (account) => {
            if (account.providerId !== 'google') return;
            await removePasswordIfUnverified(prisma, account.userId);
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            await prisma.user.updateMany({
              where: { id: session.userId },
              data: { lastLoginAt: new Date() },
            });
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

// The Nest injection token for the Better Auth instance.
export const AUTH = Symbol('AUTH');

// Google sign-in into an account whose email was never verified: the person
// proved they own the email, so whoever set the password loses access
// (spec §1). Runs before Better Auth marks the email verified.
export async function removePasswordIfUnverified(prisma: PrismaService, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.emailVerified) return;
  await prisma.$transaction([
    prisma.account.deleteMany({ where: { userId, providerId: 'credential' } }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);
}
