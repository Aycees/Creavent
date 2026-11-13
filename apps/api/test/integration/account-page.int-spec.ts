import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createUser, TEST_PASSWORD } from './factories.js';

// /account: profile, email, password, contact number (sitemap §2).
describe('account page', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

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

  it('changes the full name', async () => {
    const user = await createUser(prisma);
    const browser = await signInAs(app, user.email);

    const res = await browser.patch('/api/me').send({ fullName: 'Maria Clara Santos' });

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Maria Clara Santos');
  });

  it('refuses an empty name', async () => {
    const user = await createUser(prisma);
    const browser = await signInAs(app, user.email);

    expect((await browser.patch('/api/me').send({ fullName: ' ' })).status).toBe(400);
  });

  it('changes the mobile number', async () => {
    const user = await createUser(prisma);
    const browser = await signInAs(app, user.email);

    const res = await browser.put('/api/me/phone').send({ phone: '0918 111 2222' });

    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('+639181112222');
  });

  it('changes the email only after the new address is confirmed', async () => {
    const user = await createUser(prisma, { email: 'old@example.com' });
    const browser = await signInAs(app, user.email);

    const res = await browser
      .post('/api/auth/change-email')
      .send({ newEmail: 'new@example.com', callbackURL: '/account' });

    expect(res.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe('old@example.com');
    const email = await vi.waitFor(() =>
      prisma.emailNotification.findFirstOrThrow({ where: { type: 'email_verification', toEmail: 'new@example.com' } }),
    );
    const link = new URL((email.payload as { url: string }).url);
    await browser.get(link.pathname + link.search);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe('new@example.com');
  });

  it('changes the password with the current one', async () => {
    const user = await createUser(prisma);
    const browser = await signInAs(app, user.email);

    const wrong = await browser
      .post('/api/auth/change-password')
      .send({ currentPassword: 'not-it-at-all', newPassword: 'a-brand-new-one' });
    const right = await browser
      .post('/api/auth/change-password')
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'a-brand-new-one', revokeOtherSessions: true });

    expect(wrong.status).toBe(400);
    expect(right.status).toBe(200);
  });
});
