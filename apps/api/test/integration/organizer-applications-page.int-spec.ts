import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, signInAs } from './app.js';
import { assignedSlot, eventParts, readyFile, submittedApplication } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// The organizer's Applications page across events and the application
// detail page (decided 2026-11-15).
describe("the organizer's applications across events", () => {
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

  async function setup() {
    const organizer = await createOrganizer(prisma);
    const first = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', name: 'Lanang Holiday Flea', slotMode: 'vendor_preference' });
    const second = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', name: 'Bajada Christmas Flea' });
    const [a, b] = await Promise.all([eventParts(prisma, first), eventParts(prisma, second)]);
    const v1 = await createVendor(prisma, [a.preloved.id, a.food.id]);
    const v2 = await createVendor(prisma, [a.preloved.id]);
    const v3 = await createVendor(prisma, [a.preloved.id]);
    // v1 waits at the first event, under food, without the sanitary permit.
    const waiting = await submittedApplication(prisma, { eventId: first, vendorProfileId: v1.profile.id, categoryId: a.food.id, preferredSlotId: a.slots[2].id, submittedAt: new Date('2026-11-10T02:00:00Z') });
    await prisma.applicationDocument.create({ data: { applicationId: waiting.id, requirementId: a.clearance.id, fileId: (await readyFile(prisma, v1.user.id)).id } });
    // v2 waits at the second event.
    const later = await submittedApplication(prisma, { eventId: second, vendorProfileId: v2.profile.id, categoryId: b.preloved.id, submittedAt: new Date('2026-11-12T02:00:00Z') });
    // v3 has a slot at the first event.
    const slot = await assignedSlot(prisma, { eventId: first, vendorProfileId: v3.profile.id, categoryId: a.preloved.id, slotId: a.slots[0].id, organizerUserId: organizer.user.id });
    return { organizer, first, second, a, b, v1, v2, v3, waiting, later, slot, browser: await signInAs(app, organizer.user.email) };
  }

  it('lists waiting applications across events, oldest first, with what the card needs', async () => {
    const s = await setup();

    const res = await s.browser.get('/api/organizer/applications');

    expect(res.status).toBe(200);
    expect(res.body.applications.map((x: { id: string }) => x.id)).toEqual([s.waiting.id, s.later.id]);
    expect(res.body.applications[0]).toMatchObject({
      eventId: s.first,
      eventName: 'Lanang Holiday Flea',
      shopName: "Lola's Ukay",
      stage: 'submitted',
      categories: ['Food and drinks'],
      documents: { count: 1, pdfs: 0, missing: ['Sanitary permit'] },
      preferredSlot: { label: 'B-01', state: 'open' },
      submittedAt: '2026-11-10T02:00:00.000Z',
    });
    expect(res.body.counts).toMatchObject({ waiting: 2, slot_assigned: 1, all: 3 });
    expect(res.body.summary).toMatchObject({ waiting: 2, oldestWaitingAt: '2026-11-10T02:00:00.000Z' });
    expect(res.body.events.map((e: { name: string }) => e.name).sort()).toEqual(['Bajada Christmas Flea', 'Lanang Holiday Flea']);
  });

  it('filters by event, status, and shop name', async () => {
    const s = await setup();

    const byEvent = await s.browser.get(`/api/organizer/applications?eventId=${s.second}`);
    const assigned = await s.browser.get('/api/organizer/applications?status=slot_assigned');
    const search = await s.browser.get('/api/organizer/applications?status=all&q=lola');

    expect(byEvent.body.applications.map((x: { id: string }) => x.id)).toEqual([s.later.id]);
    expect(assigned.body.applications).toEqual([expect.objectContaining({ id: s.slot.application.id, stage: 'slot_assigned', slotLabel: 'A-01' })]);
    expect(search.body.applications).toHaveLength(3);
  });

  it('counts waiting applications for the side menu', async () => {
    const s = await setup();

    expect((await s.browser.get('/api/organizer/applications/count')).body).toEqual({ waiting: 2 });
  });

  it('shows one application in full, with the next waiting one', async () => {
    const s = await setup();

    const res = await s.browser.get(`/api/organizer/applications/${s.waiting.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: s.waiting.id,
      stage: 'submitted',
      event: { id: s.first, name: 'Lanang Holiday Flea', preferredSlots: true },
      vendor: { shopName: "Lola's Ukay", phone: '+639181234567' },
      categories: [{ name: 'Food and drinks', approved: 0, max: null }],
      missingDocuments: ['Sanitary permit'],
      preferredSlot: { label: 'B-01', state: 'open' },
      assignment: null,
      nextWaitingId: s.later.id,
    });
    expect(res.body.documents).toEqual([expect.objectContaining({ name: 'Barangay business clearance', isPdf: false })]);
  });

  it('shows the history of the same vendor at the event', async () => {
    const s = await setup();
    const old = await prisma.application.create({
      data: {
        eventId: s.first,
        vendorProfileId: s.v1.profile.id,
        status: 'withdrawn',
        withdrawnAt: new Date('2026-11-03T02:00:00Z'),
        policyTextSnapshot: 'Pay within 24 hours.',
        policyAcceptedAt: new Date('2026-11-01T02:00:00Z'),
        submittedAt: new Date('2026-11-01T02:00:00Z'),
      },
    });

    const res = await s.browser.get(`/api/organizer/applications/${s.waiting.id}`);

    expect(res.body.history).toEqual([{ id: old.id, status: 'withdrawn', submittedAt: '2026-11-01T02:00:00.000Z' }]);
  });

  it("hides other organizers' applications", async () => {
    const s = await setup();
    const stranger = await createOrganizer(prisma);
    const browser = await signInAs(app, stranger.user.email);

    expect((await browser.get('/api/organizer/applications')).body.applications).toEqual([]);
    expect((await browser.get(`/api/organizer/applications/${s.waiting.id}`)).status).toBe(404);
    const vendor = await signInAs(app, s.v1.user.email);
    expect((await vendor.get('/api/organizer/applications')).status).toBe(403);
  });
});
