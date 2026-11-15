import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { readyEvent } from './events.js';
import { assignedSlot, eventParts, readyFile, submittedApplication } from './applications.js';
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

  it('counts what needs doing per open event, and how the slots are filled', async () => {
    const { user, profile } = await createOrganizer(prisma);
    const eventId = await readyEvent(prisma, profile.id, { status: 'open_to_vendors', startsAt: new Date(Date.now() + 10 * 86_400_000), endsAt: new Date(Date.now() + 11 * 86_400_000 + 60_000) });
    const parts = await eventParts(prisma, eventId);
    const base = { eventId, categoryId: parts.preloved.id, organizerUserId: user.id };
    const v = await Promise.all([0, 1, 2, 3, 4].map(() => createVendor(prisma, [parts.preloved.id])));
    await submittedApplication(prisma, { ...base, vendorProfileId: v[0].profile.id, submittedAt: new Date('2026-11-10T02:00:00Z') });
    await submittedApplication(prisma, { ...base, vendorProfileId: v[1].profile.id });
    const proof = await assignedSlot(prisma, { ...base, vendorProfileId: v[2].profile.id, slotId: parts.slots[0].id, price: 800 });
    await prisma.payment.update({ where: { id: proof.payment.id }, data: { status: 'submitted' } });
    const method = await prisma.eventPaymentMethod.findFirstOrThrow({ where: { eventId } });
    await prisma.paymentProof.create({
      data: { paymentId: proof.payment.id, eventId, vendorProfileId: v[2].profile.id, uploadedById: v[2].user.id, fileId: (await readyFile(prisma, v[2].user.id, 'payment_proof')).id, paymentMethodId: method.id },
    });
    await assignedSlot(prisma, { ...base, vendorProfileId: v[3].profile.id, slotId: parts.slots[1].id, deadlineAt: new Date(Date.now() - 60_000) });
    const approved = await submittedApplication(prisma, { ...base, vendorProfileId: v[4].profile.id });
    await prisma.application.update({ where: { id: approved.id }, data: { status: 'approved' } });
    const browser = await signInAs(app, user.email);

    const res = await browser.get('/api/organizer/events');

    expect(res.body.todo).toEqual([
      {
        eventId,
        name: expect.any(String),
        applicationsToReview: 2,
        oldestApplicationAt: '2026-11-10T02:00:00.000Z',
        proofsToCheck: 1,
        proofsTotal: 800,
        overduePayments: 1,
        approvedNoSlot: 1,
        openSlots: 1,
      },
    ]);
    expect(res.body.upcoming[0]).toMatchObject({ fill: { reserved: 0, assigned: 2, open: 1 }, nextStep: 'Review 2 applications' });
  });
});
