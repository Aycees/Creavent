import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { signInAs } from './app.js';
import { createTestApp } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createUser, createVendor } from './factories.js';
import { MemoryStorage } from './memory-storage.js';

const pdf = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
const png = () => sharp({ create: { width: 600, height: 400, channels: 3, background: '#1b7a4c' } }).png().toBuffer();

// Application documents and proofs of payment: private uploads, and PDFs for
// documents (spec §11.1, §11.4, §11.6).
describe('document and proof uploads', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let storage: MemoryStorage;

  beforeAll(() => {
    prisma = createTestPrisma();
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

  async function vendor() {
    const { user } = await createVendor(prisma);
    return { user, browser: await signInAs(app, user.email) };
  }

  type Browser = Awaited<ReturnType<typeof vendor>>['browser'];

  async function upload(browser: Browser, purpose: string, body: Buffer, mimeType: string) {
    const ask = await browser.post('/api/files').send({ purpose, mimeType, sizeBytes: body.length });
    if (ask.status !== 201) return { ask, complete: undefined };
    storage.upload(`incoming/${ask.body.fileId}`, body, mimeType);
    return { ask, complete: await browser.post(`/api/files/${ask.body.fileId}/complete`).send({}) };
  }

  it('stores a PDF application document as uploaded, in the private bucket', async () => {
    const { browser } = await vendor();

    const { ask, complete } = await upload(browser, 'application_document', pdf, 'application/pdf');

    expect(ask.status).toBe(201);
    expect(complete!.status).toBe(201);
    const file = await prisma.file.findUniqueOrThrow({ where: { id: ask.body.fileId } });
    expect(file).toMatchObject({ status: 'ready', mimeType: 'application/pdf', storageKey: `application_document/${file.id}.pdf` });
    expect(storage.objects.get(`private/${file.storageKey}`)?.body.equals(pdf)).toBe(true);
    expect(storage.objects.has(`private/incoming/${file.id}`)).toBe(false);
    expect(complete!.body.url).toBe(`/api/files/${file.id}`);
  });

  it('re-encodes an image application document to WebP in the private bucket', async () => {
    const { browser } = await vendor();

    const { ask, complete } = await upload(browser, 'application_document', await png(), 'image/png');

    expect(complete!.status).toBe(201);
    const file = await prisma.file.findUniqueOrThrow({ where: { id: ask.body.fileId } });
    expect(file).toMatchObject({ mimeType: 'image/webp', storageKey: `application_document/${file.id}.webp` });
    expect(storage.objects.has(`private/${file.storageKey}`)).toBe(true);
  });

  it('refuses a file that claims to be a PDF but is not', async () => {
    const { browser } = await vendor();

    const { complete } = await upload(browser, 'application_document', await png(), 'application/pdf');

    expect(complete!.status).toBe(400);
    expect(complete!.body.message).toBe("This file isn't the type it claims to be");
  });

  it('refuses a PDF for a proof of payment, which must be a photo', async () => {
    const { browser } = await vendor();

    const { ask } = await upload(browser, 'payment_proof', pdf, 'application/pdf');

    expect(ask.status).toBe(400);
  });

  it('lets only vendors upload application documents and proofs', async () => {
    const user = await createUser(prisma);
    const browser = await signInAs(app, user.email);

    for (const purpose of ['application_document', 'payment_proof']) {
      const res = await browser.post('/api/files').send({ purpose, mimeType: 'image/png', sizeBytes: 1000 });
      expect(res.status).toBe(403);
    }
  });

  it('sends the uploader a download of their PDF, named from the purpose and date', async () => {
    const { browser } = await vendor();
    const { ask } = await upload(browser, 'application_document', pdf, 'application/pdf');

    const res = await browser.get(`/api/files/${ask.body.fileId}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/download=application-document-\d{4}-\d{2}-\d{2}\.pdf/);
  });

  it('hides a document from another vendor', async () => {
    const { browser } = await vendor();
    const { ask } = await upload(browser, 'application_document', pdf, 'application/pdf');
    const other = await vendor();

    const res = await other.browser.get(`/api/files/${ask.body.fileId}`);

    expect(res.status).toBe(404);
  });
});
