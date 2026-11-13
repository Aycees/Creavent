import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { removePasswordIfUnverified } from '../../src/auth/auth.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { agent, createTestApp } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';

const password = 'ukaylover22';

describe('accounts: legal acceptance and Google sign-in', () => {
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
    delete process.env.TERMS_VERSION;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function signedIn(email = 'lola@example.com') {
    await agent(app).post('/api/auth/sign-up/email').send({
      name: 'Lola',
      email,
      password,
      ageConfirmed: true,
      acceptLegal: true,
    });
    await prisma.user.update({ where: { email }, data: { emailVerified: true } });
    const browser = agent(app);
    await browser.post('/api/auth/sign-in/email').send({ email, password });
    return browser;
  }

  it('asks for acceptance again when the terms version changes', async () => {
    const browser = await signedIn();
    process.env.TERMS_VERSION = '2027-01-01';

    const me = await browser.get('/api/me');

    expect(me.body.needsLegal).toBe(true);
  });

  it('records the new version when the user accepts it', async () => {
    const browser = await signedIn();
    process.env.TERMS_VERSION = '2027-01-01';

    const res = await browser.post('/api/me/legal').send({ ageConfirmed: true, acceptLegal: true });

    expect(res.status).toBe(200);
    expect(res.body.needsLegal).toBe(false);
    const versions = await prisma.legalAcceptance.findMany({
      where: { document: 'terms' },
      orderBy: { acceptedAt: 'asc' },
    });
    expect(versions.map((v) => v.version)).toEqual(['2026-11-12', '2027-01-01']);
  });

  it('refuses an acceptance without the checkboxes', async () => {
    const browser = await signedIn();

    const res = await browser.post('/api/me/legal').send({ acceptLegal: true });

    expect(res.status).toBe(400);
  });

  it('asks a user with no age confirmation, such as a Google signup, to confirm it', async () => {
    const browser = await signedIn();
    await prisma.user.updateMany({ data: { ageConfirmedAt: null } });

    expect((await browser.get('/api/me')).body.needsLegal).toBe(true);
    await browser.post('/api/me/legal').send({ ageConfirmed: true, acceptLegal: true });
    const user = await prisma.user.findFirstOrThrow();
    expect(user.ageConfirmedAt).not.toBeNull();
  });

  it('serves the current legal versions and support email', async () => {
    const res = await agent(app).get('/api/legal');

    expect(res.body).toMatchObject({
      termsVersion: '2026-11-12',
      privacyVersion: '2026-11-12',
      minimumAge: 18,
    });
  });

  it('removes the password of an unverified account when Google signs into it', async () => {
    await agent(app).post('/api/auth/sign-up/email').send({
      name: 'Someone else',
      email: 'maria@example.com',
      password,
      ageConfirmed: true,
      acceptLegal: true,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'maria@example.com' } });

    await removePasswordIfUnverified(new PrismaService(), user.id);

    expect(await prisma.account.count({ where: { userId: user.id, providerId: 'credential' } })).toBe(0);
  });

  it('keeps the password of a verified account when Google is linked to it', async () => {
    await signedIn('maria@example.com');
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'maria@example.com' } });

    await removePasswordIfUnverified(new PrismaService(), user.id);

    expect(await prisma.account.count({ where: { userId: user.id, providerId: 'credential' } })).toBe(1);
  });
});
