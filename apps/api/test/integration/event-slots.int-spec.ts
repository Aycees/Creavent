import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { agent, createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer } from './factories.js';
import { MemoryStorage } from './memory-storage.js';

type Browser = ReturnType<typeof agent>;

// Feature 2.4: the Slots and Public floor plan tabs (spec §3.4).
describe('event slots and floor plans', () => {
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

  async function floorPlan(browser: Browser, purpose: 'vendor_floor_plan' | 'public_floor_plan') {
    const body = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#fff' } }).png().toBuffer();
    const ask = await browser.post('/api/files').send({ purpose, mimeType: 'image/png', sizeBytes: body.length });
    expect(ask.status).toBe(201);
    storage.upload(`incoming/${ask.body.fileId}`, body);
    return (await browser.post(`/api/files/${ask.body.fileId}/complete`).send({})).body as { id: string; url: string };
  }

  const labels = (res: { body: { slots: { list: { label: string }[] } } }) => res.body.slots.list.map((s) => s.label);

  it('starts with no slots, organizer assignment, and no floor plans', async () => {
    const browser = await organizer();
    const id = await draft(browser);

    const res = await browser.get(`/api/organizer/events/${id}`);

    expect(res.body.slots).toEqual({ mode: 'organizer_assigns', defaultPrice: null, vendorFloorPlan: null, publicFloorPlan: null, list: [] });
  });

  it('adds a slot with a section, size, note, and price', async () => {
    const browser = await organizer();
    const id = await draft(browser);

    const res = await browser
      .post(`/api/organizer/events/${id}/slots`)
      .send({ label: 'B-01', section: 'Entrance', sizeLabel: '3 × 3 m', note: 'Corner by the gate', price: 1500 });

    expect(res.status).toBe(201);
    expect(res.body.slots.list).toMatchObject([{ label: 'B-01', section: 'Entrance', sizeLabel: '3 × 3 m', note: 'Corner by the gate', price: 1500 }]);
  });

  it('adds a row of slots, keeping the zero padding', async () => {
    const browser = await organizer();
    const id = await draft(browser);

    const res = await browser
      .post(`/api/organizer/events/${id}/slots/row`)
      .send({ section: 'Outdoor', prefix: 'C', from: '01', to: '06', sizeLabel: '3 × 3 m', price: 1200 });

    expect(res.status).toBe(201);
    expect(labels(res)).toEqual(['C-01', 'C-02', 'C-03', 'C-04', 'C-05', 'C-06']);
    expect(res.body.slots.list[5]).toMatchObject({ section: 'Outdoor', sizeLabel: '3 × 3 m', price: 1200 });
  });

  it('adds numbered slots with no prefix, and grows past the padding', async () => {
    const browser = await organizer();
    const id = await draft(browser);

    const res = await browser.post(`/api/organizer/events/${id}/slots/row`).send({ prefix: '', from: '8', to: '11', price: null });

    expect(labels(res)).toEqual(['8', '9', '10', '11']);
  });

  it('stops a whole row when one label exists, and refuses a duplicate label', async () => {
    const browser = await organizer();
    const id = await draft(browser);
    await browser.post(`/api/organizer/events/${id}/slots`).send({ label: 'C-03', price: null });

    const row = await browser.post(`/api/organizer/events/${id}/slots/row`).send({ prefix: 'C', from: '01', to: '06', price: null });
    const single = await browser.post(`/api/organizer/events/${id}/slots`).send({ label: 'c-03', price: null });

    expect(row.status).toBe(409);
    expect(row.body.message).toBe('C-03 is already in your slot list');
    expect(single.status).toBe(409);
    expect(await prisma.slot.count({ where: { eventId: id } })).toBe(1);
  });

  it.each([
    ['a backwards range', { prefix: 'C', from: '06', to: '01' }],
    ['more than 200 slots', { prefix: 'C', from: '1', to: '201' }],
    ['a range that is not numbers', { prefix: 'C', from: 'A', to: 'F' }],
  ])('refuses %s', async (_name, body) => {
    const browser = await organizer();
    const id = await draft(browser);

    expect((await browser.post(`/api/organizer/events/${id}/slots/row`).send({ ...body, price: null })).status).toBe(400);
  });

  it('refuses a negative price', async () => {
    const browser = await organizer();
    const id = await draft(browser);

    expect((await browser.post(`/api/organizer/events/${id}/slots`).send({ label: 'A-01', price: -1 })).status).toBe(400);
  });

  it('edits a slot, and allows a label freed by a removed slot', async () => {
    const browser = await organizer();
    const id = await draft(browser);
    const added = await browser.post(`/api/organizer/events/${id}/slots/row`).send({ prefix: 'A', from: '1', to: '2', price: 800 });
    const [a1, a2] = added.body.slots.list;

    const edited = await browser
      .patch(`/api/organizer/events/${id}/slots/${a1.id}`)
      .send({ label: 'A-01', section: 'Main walkway', sizeLabel: '2 × 2 m', note: 'Corner, two sides open', price: 1000 });
    await browser.delete(`/api/organizer/events/${id}/slots/${a2.id}`);
    const reused = await browser.post(`/api/organizer/events/${id}/slots`).send({ label: 'A-2', price: null });

    expect(edited.status).toBe(200);
    expect(edited.body.slots.list[0]).toMatchObject({ label: 'A-01', section: 'Main walkway', price: 1000 });
    expect(reused.status).toBe(201);
    expect(labels(reused)).toEqual(['A-01', 'A-2']);
    expect((await prisma.slot.findUniqueOrThrow({ where: { id: a2.id } })).deletedAt).not.toBeNull();
  });

  it("refuses to edit or remove another event's slot", async () => {
    const browser = await organizer();
    const a = await draft(browser);
    const b = await draft(browser);
    const slot = (await browser.post(`/api/organizer/events/${a}/slots`).send({ label: 'A-01', price: null })).body.slots.list[0];

    expect((await browser.patch(`/api/organizer/events/${b}/slots/${slot.id}`).send({ label: 'X', price: null })).status).toBe(404);
    expect((await browser.delete(`/api/organizer/events/${b}/slots/${slot.id}`)).status).toBe(404);
  });

  it('saves the slot mode, default price, and vendor floor plan', async () => {
    const browser = await organizer();
    const id = await draft(browser);
    const plan = await floorPlan(browser, 'vendor_floor_plan');

    const res = await browser
      .put(`/api/organizer/events/${id}/slot-settings`)
      .send({ mode: 'vendor_preference', defaultPrice: 800, vendorFloorPlanFileId: plan.id });

    expect(res.status).toBe(200);
    expect(res.body.slots).toMatchObject({ mode: 'vendor_preference', defaultPrice: 800, vendorFloorPlan: { id: plan.id, url: plan.url } });
  });

  it('saves and replaces the public floor plan', async () => {
    const browser = await organizer();
    const id = await draft(browser);
    const first = await floorPlan(browser, 'public_floor_plan');
    await browser.put(`/api/organizer/events/${id}/public-floor-plan`).send({ fileId: first.id });
    const second = await floorPlan(browser, 'public_floor_plan');

    const res = await browser.put(`/api/organizer/events/${id}/public-floor-plan`).send({ fileId: second.id });

    expect(res.body.slots.publicFloorPlan).toEqual({ id: second.id, url: second.url });
    expect((await prisma.file.findUniqueOrThrow({ where: { id: first.id } })).deletedAt).not.toBeNull();
  });

  it('refuses a public floor plan as the vendor floor plan', async () => {
    const browser = await organizer();
    const id = await draft(browser);
    const plan = await floorPlan(browser, 'public_floor_plan');

    const res = await browser.put(`/api/organizer/events/${id}/slot-settings`).send({ mode: 'organizer_assigns', defaultPrice: null, vendorFloorPlanFileId: plan.id });

    expect(res.status).toBe(400);
  });

  it('has the database refuse two live slots with one label', async () => {
    const browser = await organizer();
    const id = await draft(browser);
    await browser.post(`/api/organizer/events/${id}/slots`).send({ label: 'A-01', price: null });

    await expect(prisma.slot.create({ data: { eventId: id, label: 'A-01', sortOrder: 9 } })).rejects.toThrow();
  });
});
