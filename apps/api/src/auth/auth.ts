import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { AppConfig } from '../config.js';
import { describeDevice } from '../notifications/describe-device.js';
import type { OutboxService } from '../notifications/outbox.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { recordLegalAcceptance } from './legal.js';

const SIGN_UP_PATH = '/sign-up/email';
const SIGN_IN_PATH = '/sign-in/email';

// The email a request is about, normalized. Over-long values are not
// tracked: no real address is longer than 254 characters.
function emailOf(body: unknown) {
  const email = (body as { email?: unknown } | undefined)?.email;
  if (typeof email !== 'string' || email.length > 254) return '';
  return email.trim().toLowerCase();
}

// Per-email lockout after 5 failed sign-ins in 15 minutes, on top of the
// per-IP limit, so changing addresses doesn't allow more guesses. Tries are
// rows in Postgres: no cap to fill, nothing evicted, and restarts keep them.
// Each try is written before the password check and counted with the others,
// so tries sent in parallel can't get past the cap. A successful sign-in or a
// password reset clears them.
export function createLockout(prisma: PrismaService, maxTries = 5, windowMs = 15 * 60 * 1000) {
  const since = () => new Date(Date.now() - windowMs);
  return {
    // Records a try. False when the email is locked, and then nothing is kept.
    async tryStart(email: string) {
      if (email === '') return true;
      await prisma.signInAttempt.deleteMany({ where: { createdAt: { lt: since() } } });
      const attempt = await prisma.signInAttempt.create({ data: { email } });
      const count = await prisma.signInAttempt.count({ where: { email, createdAt: { gte: since() } } });
      if (count <= maxTries) return true;
      await prisma.signInAttempt.deleteMany({ where: { id: attempt.id } });
      return false;
    },
    // A try refused for another reason (such as an unverified email) is not a
    // failed guess: its row is removed.
    async tryUndo(email: string) {
      const latest = await prisma.signInAttempt.findFirst({ where: { email }, orderBy: { createdAt: 'desc' } });
      if (latest) await prisma.signInAttempt.deleteMany({ where: { id: latest.id } });
    },
    async clear(email: string) {
      await prisma.signInAttempt.deleteMany({ where: { email } });
    },
  };
}

// Better Auth inside the API (docs/architecture.md §4.2). It owns sign-up,
// sign-in, Google, email verification, password reset, and sessions.
export function createAuth(prisma: PrismaService, outbox: OutboxService, config: AppConfig) {
  const signInLockout = createLockout(prisma);
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
    extra: Record<string, string> = {},
  ) {
    await prisma.$transaction((tx) =>
      outbox.queue(tx, {
        userId: user.id,
        toEmail: user.email,
        type,
        payload: { name: user.name, url, supportEmail: config.supportEmail, ...extra },
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
      // The old address approves the change first, then the new one gets a
      // verification link, so a stolen session alone can't move the account
      // to another email (spec §8.1).
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
          await prisma.$transaction((tx) =>
            outbox.queue(tx, {
              userId: user.id,
              toEmail: user.email,
              type: 'email_change_confirmation',
              payload: { name: user.name, newEmail, url, supportEmail: config.supportEmail },
            }),
          );
        },
      },
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
      sendResetPassword: async ({ user, url }, request) => {
        // When and from what the reset was asked for, shown in the email.
        const device = describeDevice(request?.headers.get('user-agent'));
        await queueAuthEmail(user, 'password_reset', url, {
          requestedAt: new Date().toISOString(),
          ...(device ? { device } : {}),
        });
      },
      onPasswordReset: async ({ user }) => {
        await signInLockout.clear(user.email.toLowerCase());
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
          if (!(await signInLockout.tryStart(emailOf(ctx.body)))) {
            throw new APIError('TOO_MANY_REQUESTS', {
              message: 'Too many failed tries. Wait 15 minutes, or reset your password.',
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
        if (email === '') return;
        if (!(returned instanceof APIError)) await signInLockout.clear(email);
        else if (returned.statusCode !== 401) await signInLockout.tryUndo(email);
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
