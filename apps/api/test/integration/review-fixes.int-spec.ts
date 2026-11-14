import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { agent, createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { readyEvent } from './events.js';
import { createOrganizer, createVendor } from './factories.js';

type Browser = ReturnType<typeof agent>;

// Fixes from the Phase 2 code review (2026-11-15).
describe('Phase 2 review fixes', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let fleaMarket: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    fleaMarket = (await prisma.eventType.findFirstOrThrow({ where: { slug: 'flea-market' } })).id;
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    app = await createTestApp();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function organizer() {
    const { user, profile } = await createOrganizer(prisma);
    return { profile, browser: await signInAs(app, user.email) };
  }

  async function draft(browser: Browser, name = 'Matina Night Flea') {
    return (await browser.post('/api/organizer/events').send({ name, eventTypeId: fleaMarket })).body.id as string;
  }

  it('accepts centavo prices like ₱19.99 and ₱4.35', async () => {
    const { browser } = await organizer();
    const id = await draft(browser);

    const slot = await browser.post(`/api/organizer/events/${id}/slots`).send({ label: 'A-01', price: 19.99 });
    const row = await browser.post(`/api/organizer/events/${id}/slots/row`).send({ prefix: 'B', from: '1', to: '2', price: 4.35 });
    const third = await browser.post(`/api/organizer/events/${id}/slots`).send({ label: 'C-01', price: 1.005 });

    expect(slot.status).toBe(201);
    expect(slot.body.slots.list[0].price).toBe(19.99);
    expect(row.status).toBe(201);
    expect(third.status).toBe(400);
  });

  it.each([
    ['a month that does not exist', '2027-13-01'],
    ['a day the month does not have', '2027-02-31'],
  ])('refuses %s', async (_name, startDate) => {
    const { browser } = await organizer();
    const id = await draft(browser);

    const res = await browser.put(`/api/organizer/events/${id}/details`).send({
      name: 'Matina Night Flea',
      eventTypeId: fleaMarket,
      startDate,
      endDate: '2027-03-03',
      opensAt: '17:00',
      closesAt: '23:00',
      coverFileId: null,
    });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { path: string }) => d.path)).toContain('startDate');
  });

  it('names an event page link "my-event" when the name has too few letters', async () => {
    const { browser } = await organizer();

    const id = await draft(browser, '!!!');

    expect((await prisma.event.findUniqueOrThrow({ where: { id } })).slug).toBe('my-event');
  });

  it("refuses another event's cover, so retiring it can't break both events", async () => {
    const { profile, browser } = await organizer();
    const a = await readyEvent(prisma, profile.id);
    const b = await draft(browser);
    const cover = (await prisma.event.findUniqueOrThrow({ where: { id: a } })).coverFileId!;

    const res = await browser.put(`/api/organizer/events/${b}/details`).send({ name: 'B', eventTypeId: fleaMarket, coverFileId: cover });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('This picture is already used on another event. Upload it again.');
  });

  it('keeps an open event ready when its last two slots are removed at the same time', async () => {
    const { profile, browser } = await organizer();
    const id = await readyEvent(prisma, profile.id, { status: 'open_to_vendors' });
    const slots = await prisma.slot.findMany({ where: { eventId: id } });
    await browser.delete(`/api/organizer/events/${id}/slots/${slots[0].id}`);

    const results = await Promise.all(slots.slice(1).map((s) => browser.delete(`/api/organizer/events/${id}/slots/${s.id}`)));

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.slot.count({ where: { eventId: id, deletedAt: null } })).toBe(1);
  });

  describe('Browse events dates', () => {
    // Sun, Jan 17, 2027, 8 PM in Manila.
    const sunday = new Date('2027-01-17T12:00:00Z');
    const at = (date: string, time: string) => new Date(`${date}T${time}:00+08:00`);

    async function browse(query = '') {
      const { user } = await createVendor(prisma);
      const browser = await signInAs(app, user.email);
      return (await browser.get(`/api/vendor/events${query}`)).body.events.map((e: { name: string }) => e.name);
    }

    it('leaves out events that ended before today on "This weekend", and keeps those ending today', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: sunday });
      const { profile } = await createOrganizer(prisma);
      await readyEvent(prisma, profile.id, { status: 'open_to_vendors', name: 'Saturday market', startsAt: at('2027-01-16', '09:00'), endsAt: at('2027-01-16', '17:00') });
      await readyEvent(prisma, profile.id, { status: 'open_to_vendors', name: 'Sunday morning market', startsAt: at('2027-01-17', '06:00'), endsAt: at('2027-01-17', '11:00') });

      expect(await browse('?when=weekend')).toEqual(['Sunday morning market']);
      expect(await browse()).toEqual(['Sunday morning market']);
    });
  });
});
