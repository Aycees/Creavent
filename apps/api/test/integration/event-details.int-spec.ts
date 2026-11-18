import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { agent, createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { addRole, createOrganizer, createUser, createVendor } from './factories.js';
import { MemoryStorage } from './memory-storage.js';

type Browser = ReturnType<typeof agent>;

// Feature 2.1: create a draft and the Details tab (spec §3.1, §3.1.1, flow 3).
describe('event drafts and details', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let storage: MemoryStorage;
  let fleaMarket: string;
  let bazaar: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    const types = await prisma.eventType.findMany({ orderBy: { sortOrder: 'asc' } });
    fleaMarket = types.find((t) => t.slug === 'flea-market')!.id;
    bazaar = types.find((t) => t.slug === 'bazaar')!.id;
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

  async function organizer(overrides: Parameters<typeof createOrganizer>[1] = {}) {
    const { user, profile } = await createOrganizer(prisma, overrides);
    return { user, profile, browser: await signInAs(app, user.email) };
  }

  async function draft(browser: Browser, name = 'Matina Night Flea, January') {
    const res = await browser.post('/api/organizer/events').send({ name, eventTypeId: fleaMarket });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function cover(browser: Browser, width = 1600, height = 900) {
    const body = await sharp({ create: { width, height, channels: 3, background: '#fff' } }).png().toBuffer();
    const ask = await browser.post('/api/files').send({ purpose: 'event_cover', mimeType: 'image/png', sizeBytes: body.length });
    expect(ask.status).toBe(201);
    storage.upload(`incoming/${ask.body.fileId}`, body);
    return browser.post(`/api/files/${ask.body.fileId}/complete`).send({});
  }

  const details = (overrides: Record<string, unknown> = {}) => ({
    name: 'Matina Night Flea, January',
    eventTypeId: fleaMarket,
    description: 'Our monthly night market.',
    startDate: '2027-01-15',
    endDate: '2027-01-17',
    opensAt: '17:00',
    closesAt: '23:00',
    venueName: 'Matina Town Square',
    addressLine: 'MacArthur Highway, Matina',
    city: 'Davao City',
    coverFileId: null,
    vendorContactInfo: 'Joanna Lim · 0928 115 7720',
    applicationsCloseAt: '2027-01-07T23:59',
    ingressInfo: 'From 3 PM, Gate 2',
    ...overrides,
  });

  describe('create a draft', () => {
    it('creates a draft from a name and type, with a page link from the name', async () => {
      const { browser } = await organizer({ approvalStatus: 'not_submitted' });

      const res = await browser.post('/api/organizer/events').send({ name: 'Matina Night Flea, January', eventTypeId: bazaar });

      expect(res.status).toBe(201);
      const event = await prisma.event.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(event).toMatchObject({ name: 'Matina Night Flea, January', status: 'draft', eventTypeId: bazaar, slug: 'matina-night-flea-january' });
      expect(event.startsAt).toBeNull();
    });

    it('adds a number to the page link when the name is taken', async () => {
      const { browser } = await organizer();
      await draft(browser, 'Matina Night Flea');
      const second = await draft(browser, 'Matina Night Flea');

      expect((await prisma.event.findUniqueOrThrow({ where: { id: second } })).slug).toBe('matina-night-flea-2');
    });

    it('lists the active organizer event types, Flea market first, without Pop-up', async () => {
      const { browser } = await organizer();

      const res = await browser.get('/api/event-types');

      expect(res.body.eventTypes.map((t: { name: string }) => t.name)).toEqual(['Flea market', 'Bazaar']);
    });

    // Pop-up is a vendor's own event (spec §3.1, §4.7, rule 6.15).
    it('refuses the Pop-up type on an organizer event', async () => {
      const { browser } = await organizer();
      const popUp = (await prisma.eventType.findFirstOrThrow({ where: { slug: 'pop-up' } })).id;

      const created = await browser.post('/api/organizer/events').send({ name: 'X market', eventTypeId: popUp });
      const id = await draft(browser);
      const saved = await browser.put(`/api/organizer/events/${id}/details`).send(details({ eventTypeId: popUp }));

      expect(created.status).toBe(400);
      expect(saved.status).toBe(400);
      expect((await prisma.event.findUniqueOrThrow({ where: { id } })).eventTypeId).toBe(fleaMarket);
    });

    it('needs the organizer role, not suspended', async () => {
      const vendor = await createVendor(prisma);
      const suspended = await organizer({ suspendedAt: new Date() });
      const asVendor = await signInAs(app, vendor.user.email);

      expect((await asVendor.post('/api/organizer/events').send({ name: 'X market', eventTypeId: fleaMarket })).status).toBe(403);
      expect((await suspended.browser.post('/api/organizer/events').send({ name: 'X market', eventTypeId: fleaMarket })).status).toBe(403);
    });

    it('needs the organizer page and a mobile number first', async () => {
      const user = await createUser(prisma);
      await addRole(prisma, user.id, 'organizer', { onboardingStep: 1 });
      const browser = await signInAs(app, user.email);

      const res = await browser.post('/api/organizer/events').send({ name: 'X market', eventTypeId: fleaMarket });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Finish your organizer page and contact number first');
    });

    it('refuses an inactive or unknown event type, and a blank name', async () => {
      const { browser } = await organizer();
      await prisma.eventType.update({ where: { id: bazaar }, data: { isActive: false } });

      expect((await browser.post('/api/organizer/events').send({ name: 'X market', eventTypeId: bazaar })).status).toBe(400);
      expect((await browser.post('/api/organizer/events').send({ name: '  ', eventTypeId: fleaMarket })).status).toBe(400);
      await prisma.eventType.update({ where: { id: bazaar }, data: { isActive: true } });
    });
  });

  describe('details', () => {
    it('shows a new draft with empty details', async () => {
      const { browser } = await organizer();
      const id = await draft(browser);

      const res = await browser.get(`/api/organizer/events/${id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id,
        status: 'draft',
        details: { name: 'Matina Night Flea, January', eventTypeId: fleaMarket, startDate: null, venueName: null, cover: null },
      });
      expect(res.body.eventTypes).toHaveLength(2);
    });

    it('saves every detail, in Asia/Manila time', async () => {
      const { browser } = await organizer();
      const id = await draft(browser);
      const uploaded = await cover(browser);

      const res = await browser.put(`/api/organizer/events/${id}/details`).send(details({ coverFileId: uploaded.body.id }));

      expect(res.status).toBe(200);
      expect(res.body.details).toMatchObject({
        startDate: '2027-01-15',
        endDate: '2027-01-17',
        opensAt: '17:00',
        closesAt: '23:00',
        venueName: 'Matina Town Square',
        city: 'Davao City',
        applicationsCloseAt: '2027-01-07T23:59',
        ingressInfo: 'From 3 PM, Gate 2',
        cover: { id: uploaded.body.id },
      });
      const event = await prisma.event.findUniqueOrThrow({ where: { id } });
      expect(event.startsAt?.toISOString()).toBe('2027-01-15T09:00:00.000Z');
      expect(event.endsAt?.toISOString()).toBe('2027-01-17T15:00:00.000Z');
    });

    it('keeps line breaks in the description and the contact details', async () => {
      const { browser } = await organizer();
      const id = await draft(browser);

      const res = await browser
        .put(`/api/organizer/events/${id}/details`)
        .send(details({ description: 'Ukay-ukay.\n\nStreet food.', vendorContactInfo: 'Joanna\n0928 115 7720' }));

      expect(res.status).toBe(200);
      expect(res.body.details).toMatchObject({ description: 'Ukay-ukay.\n\nStreet food.', vendorContactInfo: 'Joanna\n0928 115 7720' });
    });

    it('lets a draft keep every detail but the name empty', async () => {
      const { browser } = await organizer();
      const id = await draft(browser);

      const empty = details({ description: '', startDate: null, endDate: null, opensAt: null, closesAt: null, venueName: '', addressLine: '', city: null, vendorContactInfo: '', applicationsCloseAt: null, ingressInfo: '' });
      const res = await browser.put(`/api/organizer/events/${id}/details`).send(empty);

      expect(res.status).toBe(200);
      expect(res.body.details).toMatchObject({ description: null, startDate: null, venueName: null, applicationsCloseAt: null });
    });

    it.each([
      ['more than 7 days', { endDate: '2027-01-22' }, 'endDate'],
      ['an end before the start', { endDate: '2027-01-14' }, 'endDate'],
      ['a closing time before the opening', { closesAt: '16:00' }, 'closesAt'],
      ['part of the dates', { endDate: null }, 'endDate'],
      ['applications closing after the start', { applicationsCloseAt: '2027-01-15T18:00' }, 'applicationsCloseAt'],
    ])('refuses %s', async (_name, overrides, path) => {
      const { browser } = await organizer();
      const id = await draft(browser);

      const res = await browser.put(`/api/organizer/events/${id}/details`).send(details(overrides));

      expect(res.status).toBe(400);
      expect(res.body.details.map((d: { path: string }) => d.path)).toContain(path);
    });

    it('accepts an event of exactly 7 days', async () => {
      const { browser } = await organizer();
      const id = await draft(browser);

      expect((await browser.put(`/api/organizer/events/${id}/details`).send(details({ endDate: '2027-01-21' }))).status).toBe(200);
    });

    it('has the database refuse an event longer than 7 days', async () => {
      const { profile } = await organizer();
      const type = fleaMarket;

      await expect(
        prisma.event.create({
          data: {
            organizerProfileId: profile.id,
            eventTypeId: type,
            name: 'Too long',
            slug: 'too-long',
            startsAt: new Date('2027-01-15T09:00:00Z'),
            endsAt: new Date('2027-01-23T15:00:00Z'),
          },
        }),
      ).rejects.toThrow();
    });

    it('refuses a cover that is too small, and a file that is not a cover', async () => {
      const { browser } = await organizer();
      const id = await draft(browser);

      const small = await cover(browser, 1000, 600);
      expect(small.status).toBe(400);
      expect(small.body.message).toBe('This photo is too small. Use at least 1280 x 720');

      const logo = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#fff' } }).png().toBuffer();
      const ask = await browser.post('/api/files').send({ purpose: 'organizer_logo', mimeType: 'image/png', sizeBytes: logo.length });
      storage.upload(`incoming/${ask.body.fileId}`, logo);
      await browser.post(`/api/files/${ask.body.fileId}/complete`).send({});
      expect((await browser.put(`/api/organizer/events/${id}/details`).send(details({ coverFileId: ask.body.fileId }))).status).toBe(400);
    });

    it('crops the cover to 1600 x 900, and retires a replaced one', async () => {
      const { browser } = await organizer();
      const id = await draft(browser);
      const first = await cover(browser, 2000, 2000);
      expect(first.body).toMatchObject({ width: 1600, height: 900 });
      await browser.put(`/api/organizer/events/${id}/details`).send(details({ coverFileId: first.body.id }));
      const second = await cover(browser);

      await browser.put(`/api/organizer/events/${id}/details`).send(details({ coverFileId: second.body.id }));

      expect((await prisma.file.findUniqueOrThrow({ where: { id: first.body.id } })).deletedAt).not.toBeNull();
      expect((await prisma.file.findUniqueOrThrow({ where: { id: second.body.id } })).deletedAt).toBeNull();
    });

    describe('cover crop', () => {
      // 3200 x 1800: the left half red, the right half blue.
      async function halves() {
        const red = await sharp({ create: { width: 1600, height: 1800, channels: 3, background: '#ff0000' } }).png().toBuffer();
        return sharp({ create: { width: 3200, height: 1800, channels: 3, background: '#0000ff' } })
          .composite([{ input: red, left: 0, top: 0 }])
          .png()
          .toBuffer();
      }

      async function upload(browser: Browser, crop: unknown, purpose = 'event_cover') {
        const body = await halves();
        const ask = await browser.post('/api/files').send({ purpose, mimeType: 'image/png', sizeBytes: body.length });
        storage.upload(`incoming/${ask.body.fileId}`, body);
        return browser.post(`/api/files/${ask.body.fileId}/complete`).send({ crop });
      }

      async function pixel(id: string, x: number, y: number) {
        const stored = storage.objects.get(`public/event_cover/${id}.webp`)!.body;
        const { data, info } = await sharp(stored).raw().toBuffer({ resolveWithObject: true });
        const i = (y * info.width + x) * info.channels;
        return { r: data[i], b: data[i + 2] };
      }

      it('crops the cover to the frame the organizer chose', async () => {
        const { browser } = await organizer();

        const res = await upload(browser, { x: 1600, y: 0, width: 1600, height: 900 });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ width: 1600, height: 900 });
        const left = await pixel(res.body.id, 10, 450);
        expect(left.b).toBeGreaterThan(200);
        expect(left.r).toBeLessThan(50);
      });

      it('frames a phone photo as it looks upright', async () => {
        const { browser } = await organizer();
        // Stored sideways with orientation 6, so it shows turned a quarter right:
        // the red left half ends up on top, 1800 wide and 3200 tall.
        const body = await sharp(await halves()).jpeg().withMetadata({ orientation: 6 }).toBuffer();
        const ask = await browser.post('/api/files').send({ purpose: 'event_cover', mimeType: 'image/jpeg', sizeBytes: body.length });
        storage.upload(`incoming/${ask.body.fileId}`, body, 'image/jpeg');

        const res = await browser.post(`/api/files/${ask.body.fileId}/complete`).send({ crop: { x: 0, y: 0, width: 1600, height: 900 } });

        expect(res.status).toBe(201);
        const top = await pixel(res.body.id, 800, 450);
        expect(top.r).toBeGreaterThan(200);
        expect(top.b).toBeLessThan(50);
      });

      it('scales a larger frame down to 1600 x 900', async () => {
        const { browser } = await organizer();

        const res = await upload(browser, { x: 0, y: 0, width: 3200, height: 1800 });

        expect(res.body).toMatchObject({ width: 1600, height: 900 });
      });

      it.each([
        ['outside the photo', { x: 2000, y: 0, width: 1600, height: 900 }, "The frame doesn't fit inside the photo"],
        ['not 16:9', { x: 0, y: 0, width: 1600, height: 1600 }, 'Frame the cover at 16:9'],
        ['smaller than 1280 x 720', { x: 0, y: 0, width: 1200, height: 675 }, 'Zoom out. The cover needs at least 1280 x 720 of the photo'],
      ])('refuses a frame %s', async (_name, crop, message) => {
        const { browser } = await organizer();

        const res = await upload(browser, crop);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe(message);
      });

      it('refuses a frame for a picture that is not a cover', async () => {
        const user = await createUser(prisma);
        const browser = await signInAs(app, user.email);

        const res = await upload(browser, { x: 0, y: 0, width: 1600, height: 900 }, 'avatar');

        expect(res.status).toBe(400);
      });
    });

    it('is not found for anyone but the event organizer', async () => {
      const owner = await organizer();
      const id = await draft(owner.browser);
      const other = await organizer();

      expect((await other.browser.get(`/api/organizer/events/${id}`)).status).toBe(404);
      expect((await other.browser.put(`/api/organizer/events/${id}/details`).send(details())).status).toBe(404);
      expect((await agent(app).get(`/api/organizer/events/${id}`)).status).toBe(401);
    });
  });
});
