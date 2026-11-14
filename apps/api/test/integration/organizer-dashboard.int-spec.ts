import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { readyEvent } from './events.js';
import { createOrganizer, createVendor } from './factories.js';

// Feature 2.7: the organizer dashboard's event list (spec §3.8).
describe('organizer dashboard', () => {
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
    await app.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists the organizer's own events in Upcoming and Past, with the next step", async () => {
    const { user, profile } = await createOrganizer(prisma);
    const browser = await signInAs(app, user.email);
    await browser.post('/api/organizer/events').send({ name: 'Undated draft', eventTypeId: fleaMarket });
    await readyEvent(prisma, profile.id, { name: 'Ready draft' });
    await readyEvent(prisma, profile.id, { name: 'Open market', status: 'open_to_vendors' });
    await readyEvent(prisma, profile.id, {
      name: 'Last year',
      status: 'completed',
      startsAt: new Date('2025-11-14T09:00:00Z'),
      endsAt: new Date('2025-11-14T15:00:00Z'),
    });
    const other = await createOrganizer(prisma);
    await readyEvent(prisma, other.profile.id, { name: 'Not mine' });

    const res = await browser.get('/api/organizer/events');

    expect(res.status).toBe(200);
    expect(res.body.upcoming.map((e: { name: string }) => e.name)).toEqual(['Ready draft', 'Open market', 'Undated draft']);
    expect(res.body.past.map((e: { name: string }) => e.name)).toEqual(['Last year']);
    const [readyRow, openRow, undated] = res.body.upcoming;
    expect(readyRow).toMatchObject({ status: 'draft', typeName: 'Flea market', venueName: 'Damosa Gateway', slotCount: 3, nextStep: 'Open to vendors', startDate: '2027-01-15' });
    expect(openRow.nextStep).toBe('Applications open');
    expect(undated).toMatchObject({ startDate: null, slotCount: 0, nextStep: 'Fill in details' });
  });

  it('says to get approved when a ready draft cannot be opened yet', async () => {
    const { user, profile } = await createOrganizer(prisma, { approvalStatus: 'pending_review' });
    await readyEvent(prisma, profile.id);
    const browser = await signInAs(app, user.email);

    const res = await browser.get('/api/organizer/events');

    expect(res.body.upcoming[0].nextStep).toBe('Get approved to open');
  });

  it('names the first missing step of a draft', async () => {
    const { user, profile } = await createOrganizer(prisma);
    const id = await readyEvent(prisma, profile.id);
    await prisma.eventPaymentMethod.updateMany({ where: { eventId: id }, data: { isActive: false } });
    const browser = await signInAs(app, user.email);

    expect((await browser.get('/api/organizer/events')).body.upcoming[0].nextStep).toBe('Add payment details');
  });

  it('needs the organizer role', async () => {
    const { user } = await createVendor(prisma);
    const browser = await signInAs(app, user.email);

    expect((await browser.get('/api/organizer/events')).status).toBe(403);
  });
});
