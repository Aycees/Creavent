import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, signInAs } from './app.js';
import { assignedSlot, eventParts, submittedApplication } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// Feature 3.7: the vendor dashboard (spec §4.6).
describe('the vendor dashboard', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;

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

  // Ends a day and a minute later, so the closing time is always after the
  // opening time whatever the hour the tests run (data model §6.13).
  const days = (n: number) => ({ startsAt: new Date(Date.now() + n * 86_400_000), endsAt: new Date(Date.now() + (n + 1) * 86_400_000 + 60_000) });

  it('shows the payment due, the applications, the next confirmed event, and events open to vendors', async () => {
    const organizer = await createOrganizer(prisma, { displayName: 'Sari-Sari Collective' });
    const due = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', name: 'Bajada Christmas Flea', ...days(20) });
    const confirmed = await readyEvent(prisma, organizer.profile.id, { status: 'announced', name: 'Matina Night Flea', ...days(5) });
    await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', name: 'Lanang Holiday Flea', ...days(30) });
    await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', name: 'Closed market', applicationsOpen: false, ...days(25) });
    const [d, c] = await Promise.all([eventParts(prisma, due), eventParts(prisma, confirmed)]);
    const vendor = await createVendor(prisma, [d.preloved.id]);
    const base = { vendorProfileId: vendor.profile.id, categoryId: d.preloved.id, organizerUserId: organizer.user.id };
    const payDue = await assignedSlot(prisma, { ...base, eventId: due, slotId: d.slots[2].id, price: 1500 });
    const reserved = await assignedSlot(prisma, { ...base, eventId: confirmed, slotId: c.slots[0].id });
    await prisma.slotAssignment.update({ where: { id: reserved.assignment.id }, data: { status: 'reserved' } });
    await prisma.payment.update({ where: { id: reserved.payment.id }, data: { status: 'approved' } });
    const browser = await signInAs(app, vendor.user.email);

    const res = await browser.get('/api/vendor/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.needsAction).toEqual([
      expect.objectContaining({ applicationId: payDue.application.id, eventName: 'Bajada Christmas Flea', slotLabel: 'B-01', amountDue: 1500, organizerName: 'Sari-Sari Collective', paidTo: 'GCash', rejected: false }),
    ]);
    expect(res.body.applications).toHaveLength(2);
    expect(res.body.nextEvent).toMatchObject({ applicationId: reserved.application.id, slotLabel: 'A-01', ingressInfo: 'From 1 PM, Gate 2', event: { name: 'Matina Night Flea' } });
    expect(res.body.openEvents.map((e: { name: string }) => e.name)).toEqual(['Bajada Christmas Flea', 'Lanang Holiday Flea']);
    expect(res.body.openEvents[0].applied).toBe(true);
  });

  it('flags a rejected proof as needing a new upload', async () => {
    const organizer = await createOrganizer(prisma);
    const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', ...days(10) });
    const parts = await eventParts(prisma, eventId);
    const vendor = await createVendor(prisma, [parts.preloved.id]);
    const slot = await assignedSlot(prisma, { eventId, vendorProfileId: vendor.profile.id, categoryId: parts.preloved.id, slotId: parts.slots[0].id, organizerUserId: organizer.user.id });
    await prisma.payment.update({ where: { id: slot.payment.id }, data: { status: 'rejected' } });
    await submittedApplication(prisma, { eventId: await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', ...days(12) }), vendorProfileId: vendor.profile.id, categoryId: parts.preloved.id });
    const browser = await signInAs(app, vendor.user.email);

    const res = await browser.get('/api/vendor/dashboard');

    expect(res.body.needsAction[0]).toMatchObject({ rejected: true });
    expect(res.body.nextEvent).toBeNull();
  });

  it('needs the vendor role', async () => {
    const organizer = await createOrganizer(prisma);
    const browser = await signInAs(app, organizer.user.email);

    expect((await browser.get('/api/vendor/dashboard')).status).toBe(403);
  });
});
