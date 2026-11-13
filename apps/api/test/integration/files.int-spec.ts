import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { agent, createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createUser } from './factories.js';
import { MemoryStorage } from './memory-storage.js';

function image(width: number, height: number, format: 'png' | 'jpeg' = 'png') {
  return sharp({ create: { width, height, channels: 3, background: '#c93c17' } })
    .withExif({ IFD0: { Copyright: 'secret location' } })
    [format]()
    .toBuffer();
}

// Uploads: Ask, Upload, Complete (spec §11.3, §11.4, §11.5).
describe('file uploads', () => {
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

  async function signedIn() {
    const user = await createUser(prisma);
    return { user, browser: await signInAs(app, user.email) };
  }

  async function uploadAvatar(browser: Awaited<ReturnType<typeof signedIn>>['browser'], body: Buffer, mimeType = 'image/png') {
    const ask = await browser.post('/api/files').send({ purpose: 'avatar', mimeType, sizeBytes: body.length });
    expect(ask.status).toBe(201);
    storage.upload(`incoming/${ask.body.fileId}`, body, mimeType);
    return { ask, complete: await browser.post(`/api/files/${ask.body.fileId}/complete`).send({}) };
  }

  it('needs a signed-in user', async () => {
    const res = await agent(app).post('/api/files').send({ purpose: 'avatar', mimeType: 'image/png', sizeBytes: 100 });

    expect(res.status).toBe(401);
  });

  it('answers an Ask with a pending file and a signed upload address', async () => {
    const { user, browser } = await signedIn();

    const res = await browser.post('/api/files').send({ purpose: 'avatar', mimeType: 'image/png', sizeBytes: 1000 });

    expect(res.status).toBe(201);
    expect(res.body.uploadUrl).toBe(`https://storage.test/private/incoming/${res.body.fileId}`);
    const file = await prisma.file.findUniqueOrThrow({ where: { id: res.body.fileId } });
    expect(file).toMatchObject({ uploadedBy: user.id, purpose: 'avatar', status: 'pending', storageKey: `avatar/${file.id}.webp` });
  });

  it('refuses a type that is not a JPEG, PNG, or WebP photo', async () => {
    const { browser } = await signedIn();

    const res = await browser.post('/api/files').send({ purpose: 'avatar', mimeType: 'image/heic', sizeBytes: 1000 });

    expect(res.status).toBe(400);
  });

  it('refuses a file over the size limit of its purpose', async () => {
    const { browser } = await signedIn();

    const res = await browser.post('/api/files').send({ purpose: 'avatar', mimeType: 'image/png', sizeBytes: 6 * 1024 * 1024 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('This file is over 5 MB');
  });

  it('refuses more than 20 pending uploads at a time', async () => {
    const { browser } = await signedIn();
    for (let i = 0; i < 20; i += 1) {
      await browser.post('/api/files').send({ purpose: 'vendor_photo', mimeType: 'image/png', sizeBytes: 1000 });
    }

    const res = await browser.post('/api/files').send({ purpose: 'vendor_photo', mimeType: 'image/png', sizeBytes: 1000 });

    expect(res.status).toBe(429);
  });

  it('completes an upload: re-encodes to WebP, crops the avatar square, and removes photo metadata', async () => {
    const { browser } = await signedIn();

    const { ask, complete } = await uploadAvatar(browser, await image(800, 600));

    expect(complete.status).toBe(201);
    expect(complete.body).toMatchObject({ id: ask.body.fileId, purpose: 'avatar', width: 256, height: 256 });
    expect(complete.body.url).toBe(`https://files.test/avatar/${ask.body.fileId}.webp`);
    const stored = storage.objects.get(`public/avatar/${ask.body.fileId}.webp`);
    const meta = await sharp(stored!.body).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
    expect(storage.objects.has(`private/incoming/${ask.body.fileId}`)).toBe(false);
    const file = await prisma.file.findUniqueOrThrow({ where: { id: ask.body.fileId } });
    expect(file.status).toBe('ready');
    expect(file.mimeType).toBe('image/webp');
  });

  it('refuses an avatar smaller than 256 x 256, and deletes the upload', async () => {
    const { browser } = await signedIn();

    const { ask, complete } = await uploadAvatar(browser, await image(200, 200));

    expect(complete.status).toBe(400);
    expect(complete.body.message).toBe('This photo is too small. Use at least 256 x 256');
    expect(await prisma.file.count({ where: { id: ask.body.fileId } })).toBe(0);
    expect(storage.objects.size).toBe(0);
  });

  it('refuses a file whose real type differs from the declared one', async () => {
    const { browser } = await signedIn();

    const { complete } = await uploadAvatar(browser, await image(400, 400, 'jpeg'), 'image/png');

    expect(complete.status).toBe(400);
    expect(complete.body.message).toBe("This file isn't the type it claims to be");
  });

  it('refuses a file that is not an image at all', async () => {
    const { browser } = await signedIn();

    const { complete } = await uploadAvatar(browser, Buffer.from('%PDF-1.7 not an image'), 'image/png');

    expect(complete.status).toBe(400);
  });

  it('refuses to complete an upload that never arrived', async () => {
    const { browser } = await signedIn();
    const ask = await browser.post('/api/files').send({ purpose: 'avatar', mimeType: 'image/png', sizeBytes: 1000 });

    const res = await browser.post(`/api/files/${ask.body.fileId}/complete`).send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("We didn't get the file. Try again.");
  });

  it("does not let a user complete someone else's upload", async () => {
    const { browser } = await signedIn();
    const ask = await browser.post('/api/files').send({ purpose: 'avatar', mimeType: 'image/png', sizeBytes: 1000 });
    const other = await createUser(prisma);
    const otherBrowser = await signInAs(app, other.email);

    const res = await otherBrowser.post(`/api/files/${ask.body.fileId}/complete`).send({});

    expect(res.status).toBe(404);
  });
});
