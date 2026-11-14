import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { appConfig } from '../../src/config.js';
import { agent, createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer } from './factories.js';

type Browser = ReturnType<typeof agent>;

// Feature 2.2: the Requirements and Policy tabs (spec §3.2, §3.7).
describe('event requirements and policy', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let fleaMarket: string;
  let categories: { id: string; name: string }[];

  beforeAll(async () => {
    prisma = createTestPrisma();
    fleaMarket = (await prisma.eventType.findFirstOrThrow({ where: { slug: 'flea-market' } })).id;
    categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
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

  const food = () => categories.find((c) => c.name === 'Food and drinks')!.id;
  const preloved = () => categories.find((c) => c.name === 'Preloved clothing')!.id;

  async function organizer() {
    const { user } = await createOrganizer(prisma);
    return signInAs(app, user.email);
  }

  async function draft(browser: Browser, name = 'Matina Night Flea') {
    return (await browser.post('/api/organizer/events').send({ name, eventTypeId: fleaMarket })).body.id as string;
  }

  describe('requirements', () => {
    it('saves accepted categories with limits, and documents for everyone or one category', async () => {
      const browser = await organizer();
      const id = await draft(browser);

      const res = await browser.put(`/api/organizer/events/${id}/requirements`).send({
        categories: [
          { categoryId: preloved(), maxVendors: 12 },
          { categoryId: food(), maxVendors: null },
        ],
        documents: [
          { name: 'Barangay business clearance', categoryId: null },
          { name: 'Sanitary permit', categoryId: food() },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.requirements.categories).toEqual([
        { categoryId: preloved(), maxVendors: 12 },
        { categoryId: food(), maxVendors: null },
      ]);
      expect(res.body.requirements.documents).toMatchObject([
        { name: 'Barangay business clearance', categoryId: null },
        { name: 'Sanitary permit', categoryId: food() },
      ]);
      expect(res.body.categories.map((c: { name: string }) => c.name)).toContain('Plants');
    });

    it('keeps a document id when it is edited, and removes documents left out', async () => {
      const browser = await organizer();
      const id = await draft(browser);
      const first = await browser.put(`/api/organizer/events/${id}/requirements`).send({
        categories: [{ categoryId: preloved(), maxVendors: null }],
        documents: [{ name: 'Clearance', categoryId: null }, { name: 'Old one', categoryId: null }],
      });
      const kept = first.body.requirements.documents[0].id;

      const res = await browser.put(`/api/organizer/events/${id}/requirements`).send({
        categories: [{ categoryId: preloved(), maxVendors: null }],
        documents: [{ id: kept, name: 'Barangay clearance', categoryId: null }],
      });

      expect(res.body.requirements.documents).toEqual([expect.objectContaining({ id: kept, name: 'Barangay clearance' })]);
      expect(await prisma.eventDocumentRequirement.count({ where: { eventId: id } })).toBe(1);
    });

    it('refuses a document for a category the event does not accept', async () => {
      const browser = await organizer();
      const id = await draft(browser);

      const res = await browser.put(`/api/organizer/events/${id}/requirements`).send({
        categories: [{ categoryId: preloved(), maxVendors: null }],
        documents: [{ name: 'Sanitary permit', categoryId: food() }],
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Accept this category to ask for its document');
    });

    it('refuses a limit below 1, an inactive category, and a category twice', async () => {
      const browser = await organizer();
      const id = await draft(browser);
      await prisma.category.update({ where: { id: food() }, data: { isActive: false } });

      const zero = await browser.put(`/api/organizer/events/${id}/requirements`).send({ categories: [{ categoryId: preloved(), maxVendors: 0 }], documents: [] });
      const inactive = await browser.put(`/api/organizer/events/${id}/requirements`).send({ categories: [{ categoryId: food(), maxVendors: null }], documents: [] });
      const twice = await browser
        .put(`/api/organizer/events/${id}/requirements`)
        .send({ categories: [{ categoryId: preloved(), maxVendors: null }, { categoryId: preloved(), maxVendors: 3 }], documents: [] });
      await prisma.category.update({ where: { id: food() }, data: { isActive: true } });

      expect([zero.status, inactive.status, twice.status]).toEqual([400, 400, 400]);
    });

    it("refuses a document id from another event", async () => {
      const browser = await organizer();
      const a = await draft(browser, 'Event A');
      const b = await draft(browser, 'Event B');
      const saved = await browser.put(`/api/organizer/events/${a}/requirements`).send({
        categories: [{ categoryId: preloved(), maxVendors: null }],
        documents: [{ name: 'Clearance', categoryId: null }],
      });

      const res = await browser.put(`/api/organizer/events/${b}/requirements`).send({
        categories: [{ categoryId: preloved(), maxVendors: null }],
        documents: [{ id: saved.body.requirements.documents[0].id, name: 'Stolen', categoryId: null }],
      });

      expect(res.status).toBe(400);
    });
  });

  describe('policy', () => {
    it('starts a first event with no policy, and offers the example', async () => {
      const browser = await organizer();
      const id = await draft(browser);

      const res = await browser.get(`/api/organizer/events/${id}`);

      expect(res.body.policy).toEqual({ text: null, copiedFrom: null, example: appConfig().examplePolicyText });
    });

    it('saves the policy', async () => {
      const browser = await organizer();
      const id = await draft(browser);

      const res = await browser.put(`/api/organizer/events/${id}/policy`).send({ text: '  Pay within 24 hours.  ' });

      expect(res.status).toBe(200);
      expect(res.body.policy.text).toBe('Pay within 24 hours.');
    });

    it('keeps the line breaks between paragraphs, and still refuses hidden characters', async () => {
      const browser = await organizer();
      const id = await draft(browser);

      const paragraphs = await browser.put(`/api/organizer/events/${id}/policy`).send({ text: 'Pay within 24 hours.\r\n\r\n\tRefunds: 50%.' });
      const hidden = await browser.put(`/api/organizer/events/${id}/policy`).send({ text: 'Pay\u202ewithin' });

      expect(paragraphs.status).toBe(200);
      expect(paragraphs.body.policy.text).toBe('Pay within 24 hours.\n\n\tRefunds: 50%.');
      expect(hidden.status).toBe(400);
    });

    it('refuses an empty policy', async () => {
      const browser = await organizer();
      const id = await draft(browser);

      expect((await browser.put(`/api/organizer/events/${id}/policy`).send({ text: '   ' })).status).toBe(400);
    });

    it("copies the policy of the organizer's most recent event, and says which", async () => {
      const browser = await organizer();
      const older = await draft(browser, 'Bajada Christmas Flea');
      await browser.put(`/api/organizer/events/${older}/policy`).send({ text: 'Older policy' });
      const recent = await draft(browser, 'Lanang Holiday Flea');
      await browser.put(`/api/organizer/events/${recent}/policy`).send({ text: 'Recent policy' });

      const id = await draft(browser, 'Matina Night Flea, January');
      const res = await browser.get(`/api/organizer/events/${id}`);

      expect(res.body.policy).toMatchObject({ text: 'Recent policy', copiedFrom: { name: 'Lanang Holiday Flea' } });
    });

    it("never copies another organizer's policy", async () => {
      const other = await organizer();
      const theirs = await draft(other, 'Their event');
      await other.put(`/api/organizer/events/${theirs}/policy`).send({ text: 'Their policy' });
      const browser = await organizer();

      const id = await draft(browser);

      expect((await browser.get(`/api/organizer/events/${id}`)).body.policy.text).toBeNull();
    });
  });
});
