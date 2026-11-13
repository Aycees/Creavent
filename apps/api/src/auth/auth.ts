import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { AppConfig } from '../config.js';
import type { OutboxService } from '../notifications/outbox.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { recordLegalAcceptance } from './legal.js';

const SIGN_UP_PATH = '/sign-up/email';
const SIGN_IN_PATH = '/sign-in/email';

function emailOf(body: unknown) {
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

// Per-email lockout after 5 failed sign-ins in 15 minutes, on top of the
// per-IP limit, so changing addresses doesn't allow more guesses. Kept in
// memory: the MVP runs one API instance.
export function createLockout(maxFailures = 5, windowMs = 15 * 60 * 1000) {
  const failures = new Map<string, number[]>();
  const recent = (email: string) => {
    const since = Date.now() - windowMs;
    const list = (failures.get(email) ?? []).filter((t) => t > since);
    failures.set(email, list);
    return list;
  };
  return {
    isLocked: (email: string) => email !== '' && recent(email).length >= maxFailures,
    fail: (email: string) => {
      if (email) failures.set(email, [...recent(email), Date.now()]);
    },
    clear: (email: string) => failures.delete(email),
  };
}

// Better Auth inside the API (docs/architecture.md §4.2). It owns sign-up,
// sign-in, Google, email verification, password reset, and sessions.
export function createAuth(prisma: PrismaService, outbox: OutboxService, config: AppConfig) {
  const signInLockout = createLockout();
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
      // The client IP is the right-most X-Forwarded-For entry not added by our
      // own proxies (the Next.js server, Render's private network). Entries a
      // client made up sit to its left and are ignored.
      ipAddress: {
        ipAddressHeaders: ['x-forwarded-for'],
        trustedProxies: ['127.0.0.0/8', '::1/128', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7'],
      },
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
        if (ctx.path === SIGN_IN_PATH) {
          if (signInLockout.isLocked(emailOf(ctx.body))) {
            throw new APIError('TOO_MANY_REQUESTS', {
              message: 'Too many failed tries. Wait 15 minutes and try again.',
            });
          }
          return;
        }
        if (ctx.path !== SIGN_UP_PATH) return;
        const body = ctx.body as { ageConfirmed?: unknown; acceptLegal?: unknown } | undefined;
        if (body?.ageConfirmed !== true || body?.acceptLegal !== true) {
          throw new APIError('BAD_REQUEST', {
            message: 'Accept the terms of use and privacy notice, and confirm you are 18 or older',
          });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SIGN_IN_PATH) return;
        const email = emailOf(ctx.body);
        const returned = ctx.context.returned;
        if (returned instanceof APIError && returned.statusCode === 401) signInLockout.fail(email);
        else if (!(returned instanceof APIError)) signInLockout.clear(email);
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
