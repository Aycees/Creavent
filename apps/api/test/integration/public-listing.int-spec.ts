import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer } from './factories.js';
import { readyEvent } from './events.js';

// Feature 4.3: the event listing (spec §7.3, flow 10, decision Q5).
describe('the event listing', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;

  // Manila dates counted from today, so the tests hold on any day.
  const day = 86_400_000;
  const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
  const plus = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * day).toISOString().slice(0, 10);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  // The coming Saturday, or today on a Saturday; Sunday counts this weekend's Saturday as yesterday.
  const saturday = weekday === 0 ? plus(-1) : plus(6 - weekday);
  const at = (date: string, time: string) => new Date(`${date}T${time}:00+08:00`);

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

  const listing = (query: Record<string, string> = {}) => request(app.getHttpServer()).get('/api/public/events').query(query);

  async function setup() {
    const sari = await createOrganizer(prisma, { displayName: 'Sari-Sari Collective' });
    const tiangge = await createOrganizer(prisma, { displayName: 'Tiangge Davao' });
    const bazaar = await prisma.eventType.findFirstOrThrow({ where: { slug: 'bazaar' } });
    const make = async (organizerProfileId: string, name: string, start: string, end: string, extra: Parameters<typeof readyEvent>[2] = {}) => {
      const id = await readyEvent(prisma, organizerProfileId, { status: 'announced', name, startsAt: at(start, '17:00'), endsAt: at(end, '23:00'), ...extra });
      return id;
    };
    // Sunday's event is in the past on a Sunday run of the tests, so it
    // goes a week out then.
    const weekend = weekday === 0 ? plus(6) : saturday;
    const matina = await make(sari.profile.id, 'Matina Night Flea', weekend, weekend);
    const vintage = await make(tiangge.profile.id, 'Lanang Vintage Swap', plus(9), plus(9));
    const fair = await make(sari.profile.id, 'Pasalubong and Handmade Fair', plus(20), plus(22));
    await prisma.event.update({ where: { id: fair }, data: { eventTypeId: bazaar.id, venueName: 'Rizal Park' } });
    // Not listed: only open to vendors, a draft, hidden, ended, canceled.
    const open = await readyEvent(prisma, sari.profile.id, { status: 'open_to_vendors', name: 'Bajada Christmas Flea', startsAt: at(plus(30), '16:00'), endsAt: at(plus(30), '22:00') });
    await readyEvent(prisma, sari.profile.id, { name: 'A draft', startsAt: at(plus(3), '16:00'), endsAt: at(plus(3), '22:00') });
    await make(sari.profile.id, 'Hidden Flea', plus(4), plus(4), { moderationState: 'hidden' });
    await make(sari.profile.id, 'Last Month Flea', plus(-30), plus(-30));
    await readyEvent(prisma, sari.profile.id, { status: 'canceled', name: 'Canceled Flea', startsAt: at(plus(5), '16:00'), endsAt: at(plus(5), '22:00') });
    return { matina, vintage, fair, open, weekend };
  }

  it('lists visible announced events that have not ended, soonest first', async () => {
    const { matina, vintage, fair } = await setup();

    const res = await listing();

    expect(res.status).toBe(200);
    expect(res.body.today).toBe(today);
    expect(res.body.events.map((e: { name: string }) => e.name)).toEqual(['Matina Night Flea', 'Lanang Vintage Swap', 'Pasalubong and Handmade Fair']);
    expect(res.body.events[0]).toMatchObject({ typeName: 'Flea market', venueName: 'Damosa Gateway', city: 'Davao City', organizer: { displayName: 'Sari-Sari Collective', approved: true } });
    expect(res.body.tags).toEqual(expect.arrayContaining(['listing', `event:${matina}`, `event:${vintage}`, `event:${fair}`]));
  });

  it('counts each type, and the events that take applications', async () => {
    await setup();

    const res = await listing();

    expect(res.body.types).toEqual([
      { slug: 'flea-market', name: 'Flea market', count: 2 },
      { slug: 'bazaar', name: 'Bazaar', count: 1 },
      { slug: 'pop-up', name: 'Pop-up', count: 0 },
    ]);
    expect(res.body.cities).toEqual(['Davao City']);
    // The three announced ones and Bajada, all with applications open.
    expect(res.body.openToVendors).toBe(4);
  });

  it('filters by type, keeping the counts of every type', async () => {
    await setup();

    const res = await listing({ type: 'bazaar' });

    expect(res.body.events.map((e: { name: string }) => e.name)).toEqual(['Pasalubong and Handmade Fair']);
    expect(res.body.types.find((t: { slug: string }) => t.slug === 'flea-market').count).toBe(2);
  });

  it('searches names, venues, cities, and organizers, matching the start of words', async () => {
    await setup();
    const names = async (q: string) => (await listing({ q })).body.events.map((e: { name: string }) => e.name);

    expect(await names('vint')).toEqual(['Lanang Vintage Swap']);
    expect(await names('rizal')).toEqual(['Pasalubong and Handmade Fair']);
    expect(await names('tiangge')).toEqual(['Lanang Vintage Swap']);
    expect(await names('night matina')).toEqual(['Matina Night Flea']);
    expect(await names('davao')).toHaveLength(3);
    expect(await names("night market's & | !")).toEqual([]);
  });

  it('filters by date, matching an event when any of its days falls in the range', async () => {
    const { weekend } = await setup();
    const names = async (query: Record<string, string>) => (await listing(query)).body.events.map((e: { name: string }) => e.name);

    expect(await names({ when: 'dates', from: plus(21), to: plus(21) })).toEqual(['Pasalubong and Handmade Fair']);
    expect(await names({ when: '2weeks' })).toEqual(['Matina Night Flea', 'Lanang Vintage Swap']);
    if (weekend === saturday) expect(await names({ when: 'weekend' })).toEqual(['Matina Night Flea']);
  });

  it('marks each of the next 7 days that has an event, every day of a multi-day one', async () => {
    const sari = await createOrganizer(prisma);
    await readyEvent(prisma, sari.profile.id, { status: 'announced', startsAt: at(plus(1), '09:00'), endsAt: at(plus(3), '17:00') });

    const res = await listing();

    expect(res.body.next7).toEqual([
      { date: today, count: 0 },
      { date: plus(1), count: 1 },
      { date: plus(2), count: 1 },
      { date: plus(3), count: 1 },
      { date: plus(4), count: 0 },
      { date: plus(5), count: 0 },
      { date: plus(6), count: 0 },
    ]);
  });
});
