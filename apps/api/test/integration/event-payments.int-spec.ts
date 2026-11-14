import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { agent, createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createUser, createVendor } from './factories.js';
import { MemoryStorage } from './memory-storage.js';

type Browser = ReturnType<typeof agent>;

// Feature 2.3: the Payments tab (spec §6.1) and the private payment QR
// (spec §11.1, data model §6.6).
describe('event payments', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let storage: MemoryStorage;
  let fleaMarket: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    fleaMarket = (await prisma.eventType.findFirstOrThrow({ where: { slug: 'flea-market' } })).id;
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    storage = new MemoryStorage();
    app = await createTestApp(storage);
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function organizer() {
    const { user } = await createOrganizer(prisma);
    return signInAs(app, user.email);
  }

  async function draft(browser: Browser) {
    return (await browser.post('/api/organizer/events').send({ name: 'Matina Night Flea', eventTypeId: fleaMarket })).body.id as string;
  }

  async function qr(browser: Browser) {
    const body = await sharp({ create: { width: 600, height: 600, channels: 3, background: '#fff' } }).png().toBuffer();
    const ask = await browser.post('/api/files').send({ purpose: 'payment_qr', mimeType: 'image/png', sizeBytes: body.length });
    expect(ask.status).toBe(201);
    storage.upload(`incoming/${ask.body.fileId}`, body);
    const done = await browser.post(`/api/files/${ask.body.fileId}/complete`).send({});
    expect(done.status).toBe(201);
    return done.body as { id: string; url: string };
  }

  const gcash = (overrides: Record<string, unknown> = {}) => ({
    channel: 'gcash',
    accountName: 'Joanna L.',
    accountNumber: '0928 115 7720',
    qrFileId: null,
    notes: null,
    ...overrides,
  });

  it('starts with the default 24-hour deadline and no options', async () => {
    const browser = await organizer();
    const id = await draft(browser);

    const res = await browser.get(`/api/organizer/events/${id}`);

    expect(res.body.payments).toEqual({ deadlineHours: 24, methods: [] });
  });

  it('saves payment options and the deadline', async () => {
    const browser = await organizer();
    const id = await draft(browser);

    const res = await browser.put(`/api/organizer/events/${id}/payments`).send({
      deadlineHours: 48,
      methods: [gcash(), { channel: 'bank', accountName: 'Joanna Lim', accountNumber: '1234 5678 90', qrFileId: null, notes: 'BPI' }],
    });

    expect(res.status).toBe(200);
    expect(res.body.payments.deadlineHours).toBe(48);
    expect(res.body.payments.methods).toMatchObject([
      { channel: 'gcash', label: 'GCash, Joanna L.', accountNumber: '0928 115 7720', qr: null },
      { channel: 'bank', label: 'Bank transfer, Joanna Lim', notes: 'BPI' },
    ]);
  });

  it('turns off a removed option instead of deleting it', async () => {
    const browser = await organizer();
    const id = await draft(browser);
    const first = await browser.put(`/api/organizer/events/${id}/payments`).send({ deadlineHours: 24, methods: [gcash(), gcash({ channel: 'maya' })] });
    const [keep, drop] = first.body.payments.methods.map((m: { id: string }) => m.id);

    const res = await browser.put(`/api/organizer/events/${id}/payments`).send({ deadlineHours: 24, methods: [{ ...gcash(), id: keep }] });

    expect(res.body.payments.methods.map((m: { id: string }) => m.id)).toEqual([keep]);
    expect((await prisma.eventPaymentMethod.findUniqueOrThrow({ where: { id: drop } })).isActive).toBe(false);
  });

  it.each([
    ['a deadline of 0 hours', { deadlineHours: 0, methods: [] }],
    ['a deadline over 7 days', { deadlineHours: 169, methods: [] }],
    ['an option with neither a number nor a QR', { deadlineHours: 24, methods: [{ channel: 'gcash', accountName: 'Joanna', accountNumber: null, qrFileId: null, notes: null }] }],
  ])('refuses %s', async (_name, body) => {
    const browser = await organizer();
    const id = await draft(browser);

    expect((await browser.put(`/api/organizer/events/${id}/payments`).send(body)).status).toBe(400);
  });

  describe('payment QR', () => {
    it('stores the QR in the private bucket, never the public one', async () => {
      const browser = await organizer();

      const file = await qr(browser);

      expect(storage.objects.has(`private/payment_qr/${file.id}.webp`)).toBe(true);
      expect(storage.objects.has(`public/payment_qr/${file.id}.webp`)).toBe(false);
      expect(file.url).toBe(`/api/files/${file.id}`);
    });

    it('lets the organizer open the attached QR through a short-lived address', async () => {
      const browser = await organizer();
      const id = await draft(browser);
      const file = await qr(browser);
      const saved = await browser.put(`/api/organizer/events/${id}/payments`).send({ deadlineHours: 24, methods: [gcash({ qrFileId: file.id })] });
      expect(saved.body.payments.methods[0].qr).toEqual({ id: file.id, url: `/api/files/${file.id}` });

      const res = await browser.get(`/api/files/${file.id}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(`https://storage.test/private/payment_qr/${file.id}.webp?expires=300`);
      expect(res.headers['cache-control']).toBe('private, no-store');
    });

    it('lets an admin open it, and no one else', async () => {
      const browser = await organizer();
      const id = await draft(browser);
      const file = await qr(browser);
      await browser.put(`/api/organizer/events/${id}/payments`).send({ deadlineHours: 24, methods: [gcash({ qrFileId: file.id })] });
      const admin = await createUser(prisma, { isAdmin: true });
      const vendor = await createVendor(prisma);
      const otherOrganizer = await createOrganizer(prisma);

      expect((await (await signInAs(app, admin.email)).get(`/api/files/${file.id}`)).status).toBe(302);
      expect((await (await signInAs(app, vendor.user.email)).get(`/api/files/${file.id}`)).status).toBe(404);
      expect((await (await signInAs(app, otherOrganizer.user.email)).get(`/api/files/${file.id}`)).status).toBe(404);
      expect((await agent(app).get(`/api/files/${file.id}`)).status).toBe(401);
    });

    it('needs the organizer role to upload a QR', async () => {
      const vendor = await createVendor(prisma);
      const browser = await signInAs(app, vendor.user.email);

      const res = await browser.post('/api/files').send({ purpose: 'payment_qr', mimeType: 'image/png', sizeBytes: 1000 });

      expect(res.status).toBe(403);
    });

    it("refuses another user's QR", async () => {
      const other = await organizer();
      const file = await qr(other);
      const browser = await organizer();
      const id = await draft(browser);

      const res = await browser.put(`/api/organizer/events/${id}/payments`).send({ deadlineHours: 24, methods: [gcash({ qrFileId: file.id })] });

      expect(res.status).toBe(400);
    });
  });
});
