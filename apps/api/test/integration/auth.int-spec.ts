import type { INestApplication } from '@nestjs/common';
import { meResponseSchema } from '@creavent/shared';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { agent, createTestApp } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';

// Sign up, verification, sign in, and password reset (spec §1, flow 1).
describe('accounts: sign up and sign in', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;

  const maria = {
    name: 'Maria Santos',
    email: 'maria.santos@example.com',
    password: 'ukaylover22',
    ageConfirmed: true,
    acceptLegal: true,
  };

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  // A fresh app per test, so the in-memory rate limits start empty.
  beforeEach(async () => {
    await resetDatabase(prisma);
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function signUp(body: object = maria) {
    return agent(app).post('/api/auth/sign-up/email').send(body);
  }

  async function verificationUrl() {
    const email = await prisma.emailNotification.findFirstOrThrow({
      where: { type: 'email_verification' },
      orderBy: { createdAt: 'desc' },
    });
    return new URL((email.payload as { url: string }).url);
  }

  async function signUpAndVerify() {
    await signUp();
    const url = await verificationUrl();
    await agent(app).get(url.pathname + url.search);
  }

  it('creates an unverified account, records the agreements, and queues a verification email', async () => {
    const res = await signUp();

    expect(res.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: maria.email },
      include: { legalAcceptances: true },
    });
    expect(user.fullName).toBe('Maria Santos');
    expect(user.emailVerified).toBe(false);
    expect(user.ageConfirmedAt).not.toBeNull();
    expect(user.legalAcceptances.map((a) => `${a.document} ${a.version}`).sort((a, b) => a.localeCompare(b))).toEqual([
      'privacy 2026-11-12',
      'terms 2026-11-12',
    ]);
    const url = await verificationUrl();
    expect(url.origin).toBe('http://localhost:3000');
    expect(url.pathname).toBe('/api/auth/verify-email');
  });

  it('refuses a signup that does not accept the terms or confirm the age', async () => {
    const res = await signUp({ ...maria, acceptLegal: false, ageConfirmed: undefined });

    expect(res.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it('refuses a name over 100 characters or with hidden characters, even from a direct API call', async () => {
    const long = await signUp({ ...maria, name: 'x'.repeat(101) });
    const hidden = await signUp({ ...maria, email: 'other@example.com', name: 'Maria\u202eSantos' });

    expect(long.status).toBe(400);
    expect(hidden.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it('refuses a password shorter than 8 characters', async () => {
    const res = await signUp({ ...maria, password: 'short' });

    expect(res.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it('does not let a signup set admin or other protected fields', async () => {
    await signUp({ ...maria, isAdmin: true });

    const user = await prisma.user.findUnique({ where: { email: maria.email } });
    expect(user?.isAdmin ?? false).toBe(false);
  });

  it('refuses to sign in before the email is verified', async () => {
    await signUp();

    const res = await agent(app)
      .post('/api/auth/sign-in/email')
      .send({ email: maria.email, password: maria.password });

    expect(res.status).toBe(403);
  });

  it('verifies the email from the link, signs the user in, and sends them on', async () => {
    await signUp();
    const url = await verificationUrl();
    const browser = agent(app);

    const res = await browser.get(url.pathname + url.search);

    expect(res.status).toBe(302);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: maria.email } });
    expect(user.emailVerified).toBe(true);
    const me = await browser.get('/api/me');
    expect(me.status).toBe(200);
    expect(meResponseSchema.parse(me.body)).toMatchObject({
      email: maria.email,
      fullName: 'Maria Santos',
      roles: [],
      needsLegal: false,
      hasPassword: true,
      isAdmin: false,
    });
  });

  it('signs in a verified user with the right password', async () => {
    await signUpAndVerify();
    const browser = agent(app);

    const res = await browser
      .post('/api/auth/sign-in/email')
      .send({ email: 'MARIA.SANTOS@example.com', password: maria.password });

    expect(res.status).toBe(200);
    expect((await browser.get('/api/me')).status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: maria.email } });
    expect(user.lastLoginAt).not.toBeNull();
  });

  it('refuses the wrong password', async () => {
    await signUpAndVerify();

    const res = await agent(app)
      .post('/api/auth/sign-in/email')
      .send({ email: maria.email, password: 'not-my-password' });

    expect(res.status).toBe(401);
  });

  it('locks sign-in for a while after 5 failed attempts', async () => {
    await signUpAndVerify();
    const tries = [];
    for (let i = 0; i < 6; i += 1) {
      tries.push(
        await agent(app)
          .post('/api/auth/sign-in/email')
          .send({ email: maria.email, password: 'wrong-password' }),
      );
    }

    expect(tries.at(-1)?.status).toBe(429);
  });

  it('ignores client-made X-Forwarded-For entries left of the proxy-added one', async () => {
    await signUpAndVerify();
    const tries = [];
    for (let i = 0; i < 6; i += 1) {
      tries.push(
        await agent(app)
          .set('X-Forwarded-For', `198.51.100.${i}, 203.0.113.200`)
          .post('/api/auth/sign-in/email')
          .send({ email: `someone${i}@example.com`, password: 'wrong-password' }),
      );
    }
    const otherClient = await agent(app)
      .set('X-Forwarded-For', '198.51.100.1, 203.0.113.201')
      .post('/api/auth/sign-in/email')
      .send({ email: 'another@example.com', password: 'wrong-password' });

    expect(tries.at(-1)?.status).toBe(429);
    expect(otherClient.status).toBe(401);
  });

  it('locks one email after 5 failed tries, even from different addresses', async () => {
    await signUpAndVerify();
    for (let i = 0; i < 5; i += 1) {
      await agent(app)
        .set('X-Forwarded-For', `198.51.100.${i}`)
        .post('/api/auth/sign-in/email')
        .send({ email: maria.email, password: 'wrong-password' });
    }

    const res = await agent(app)
      .set('X-Forwarded-For', '198.51.100.99')
      .post('/api/auth/sign-in/email')
      .send({ email: 'Maria.Santos@example.com', password: maria.password });

    expect(res.status).toBe(429);
  });

  it('counts parallel tries, so at most 5 reach the password check', async () => {
    await signUpAndVerify();

    const tries = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        agent(app)
          .set('X-Forwarded-For', `198.51.100.${i}`)
          .post('/api/auth/sign-in/email')
          .send({ email: maria.email, password: 'wrong-password' }),
      ),
    );

    expect(tries.filter((t) => t.status === 401).length).toBeLessThanOrEqual(5);
  });

  it('lifts the lockout when the password is reset', async () => {
    await signUpAndVerify();
    for (let i = 0; i < 5; i += 1) {
      await agent(app)
        .set('X-Forwarded-For', `198.51.100.${i}`)
        .post('/api/auth/sign-in/email')
        .send({ email: maria.email, password: 'wrong-password' });
    }
    await agent(app)
      .post('/api/auth/request-password-reset')
      .send({ email: maria.email, redirectTo: '/reset-password' });
    const email = await vi.waitFor(() =>
      prisma.emailNotification.findFirstOrThrow({ where: { type: 'password_reset' } }),
    );
    const link = new URL((email.payload as { url: string }).url);
    const followed = await agent(app).get(link.pathname + link.search);
    const token = new URL(followed.headers.location, 'http://localhost:3000').searchParams.get('token');
    await agent(app).post('/api/auth/reset-password').send({ newPassword: 'a-new-password', token });

    const res = await agent(app)
      .set('X-Forwarded-For', '198.51.100.50')
      .post('/api/auth/sign-in/email')
      .send({ email: maria.email, password: 'a-new-password' });

    expect(res.status).toBe(200);
  });

  it('answers 401 on /api/me without a session', async () => {
    const res = await agent(app).get('/api/me');

    expect(res.status).toBe(401);
  });

  it('signs out', async () => {
    await signUpAndVerify();
    const browser = agent(app);
    await browser.post('/api/auth/sign-in/email').send({ email: maria.email, password: maria.password });

    await browser.post('/api/auth/sign-out').send({});

    expect((await browser.get('/api/me')).status).toBe(401);
  });

  it('resets a forgotten password with the emailed link', async () => {
    await signUpAndVerify();

    const ask = await agent(app)
      .post('/api/auth/request-password-reset')
      .send({ email: maria.email, redirectTo: '/reset-password' });
    expect(ask.status).toBe(200);
    // Better Auth sends reset emails in the background, so the reply time
    // doesn't reveal whether the email has an account.
    const email = await vi.waitFor(() =>
      prisma.emailNotification.findFirstOrThrow({ where: { type: 'password_reset' } }),
    );
    const link = new URL((email.payload as { url: string }).url);
    const followed = await agent(app).get(link.pathname + link.search);
    const token = new URL(followed.headers.location, 'http://localhost:3000').searchParams.get('token');

    const reset = await agent(app)
      .post('/api/auth/reset-password')
      .send({ newPassword: 'a-new-password', token });

    expect(reset.status).toBe(200);
    const oldLogin = await agent(app).post('/api/auth/sign-in/email').send({ email: maria.email, password: maria.password });
    const newLogin = await agent(app).post('/api/auth/sign-in/email').send({ email: maria.email, password: 'a-new-password' });
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });

  it('does not reveal whether an email has an account when asking for a reset', async () => {
    const res = await agent(app)
      .post('/api/auth/request-password-reset')
      .send({ email: 'nobody@example.com', redirectTo: '/reset-password' });

    expect(res.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await prisma.emailNotification.count()).toBe(0);
  });
});
