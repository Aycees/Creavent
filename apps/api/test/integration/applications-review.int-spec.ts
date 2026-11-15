import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, signInAs } from './app.js';
import { eventParts, readyFile, submittedApplication } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// Feature 3.2: the organizer reviews applications (spec §3.3, flow 5).
describe('reviewing applications', () => {
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

  async function setup(overrides: Parameters<typeof readyEvent>[2] = {}) {
    const organizer = await createOrganizer(prisma);
    const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', ...overrides });
    const parts = await eventParts(prisma, eventId);
    const vendor = await createVendor(prisma, [parts.preloved.id]);
    const application = await submittedApplication(prisma, {
      eventId,
      vendorProfileId: vendor.profile.id,
      categoryId: parts.preloved.id,
      preferredSlotId: parts.slots[2].id,
    });
    const browser = await signInAs(app, organizer.user.email);
    return { organizer, eventId, ...parts, vendor, application, browser };
  }

  type Setup = Awaited<ReturnType<typeof setup>>;
  const decide = (s: Setup, action: 'approve' | 'decline', body: Record<string, unknown> = {}, id = s.application.id) =>
    s.browser.post(`/api/organizer/events/${s.eventId}/applications/${id}/${action}`).send(body);

  it('lists applications with the vendor, contact number, documents, preferred slot, and counters', async () => {
    const s = await setup();
    const file = await readyFile(prisma, s.vendor.user.id);
    await prisma.applicationDocument.create({ data: { applicationId: s.application.id, requirementId: s.clearance.id, fileId: file.id } });

    const res = await s.browser.get(`/api/organizer/events/${s.eventId}/applications`);

    expect(res.status).toBe(200);
    expect(res.body.event).toMatchObject({ id: s.eventId, name: s.event.name, preferredSlots: false });
    expect(res.body.counters).toEqual([
      { categoryId: s.preloved.id, name: 'Preloved clothing', approved: 0, max: 12 },
      { categoryId: s.food.id, name: 'Food and drinks', approved: 0, max: null },
    ]);
    expect(res.body.applications).toHaveLength(1);
    expect(res.body.applications[0]).toMatchObject({
      id: s.application.id,
      status: 'submitted',
      vendor: { shopName: "Lola's Ukay", phone: '+639181234567' },
      categories: [{ id: s.preloved.id, name: 'Preloved clothing' }],
      documents: [{ name: 'Barangay business clearance', url: `/api/files/${file.id}`, isPdf: false }],
      slotsRequested: 1,
      preferredSlots: [{ id: s.slots[2].id, label: 'B-01', state: 'open' }],
    });
  });

  it('shows a deleted preferred slot as no longer available', async () => {
    const s = await setup();
    await prisma.slot.update({ where: { id: s.slots[2].id }, data: { deletedAt: new Date() } });

    const res = await s.browser.get(`/api/organizer/events/${s.eventId}/applications`);

    expect(res.body.applications[0].preferredSlots[0].state).toBe('removed');
  });

  it('is Not found to another organizer and refused to a vendor', async () => {
    const s = await setup();
    const other = await createOrganizer(prisma);
    const otherBrowser = await signInAs(app, other.user.email);
    const vendorBrowser = await signInAs(app, s.vendor.user.email);

    expect((await otherBrowser.get(`/api/organizer/events/${s.eventId}/applications`)).status).toBe(404);
    expect((await otherBrowser.post(`/api/organizer/events/${s.eventId}/applications/${s.application.id}/approve`).send({})).status).toBe(404);
    expect((await vendorBrowser.get(`/api/organizer/events/${s.eventId}/applications`)).status).toBe(403);
  });

  it('approves with a note, logs it, emails the vendor, and counts the category', async () => {
    const s = await setup();

    const res = await decide(s, 'approve', { note: 'See you there!' });

    expect(res.status).toBe(201);
    const application = await prisma.application.findUniqueOrThrow({ where: { id: s.application.id } });
    expect(application).toMatchObject({ status: 'approved', decidedById: s.organizer.user.id, decisionNote: 'See you there!' });
    expect(application.decidedAt).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { entityId: s.application.id, action: 'application.approve' } })).toBe(1);
    const email = await prisma.emailNotification.findFirstOrThrow({ where: { type: 'application_approved' } });
    expect(email).toMatchObject({ toEmail: s.vendor.user.email, userId: s.vendor.user.id });
    expect(email.payload).toMatchObject({ eventName: s.event.name, note: 'See you there!' });
    expect(res.body.counters[0]).toMatchObject({ name: 'Preloved clothing', approved: 1 });
  });

  it('still approves when the category limit is reached', async () => {
    const s = await setup();
    await prisma.eventCategory.update({ where: { eventId_categoryId: { eventId: s.eventId, categoryId: s.preloved.id } }, data: { maxVendors: 1 } });
    const first = await createVendor(prisma, [s.preloved.id]);
    const full = await submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: first.profile.id, categoryId: s.preloved.id });
    await prisma.application.update({ where: { id: full.id }, data: { status: 'approved' } });

    expect((await decide(s, 'approve')).status).toBe(201);
  });

  it('declines with a note and emails the vendor the note', async () => {
    const s = await setup();

    const res = await decide(s, 'decline', { note: 'We have enough clothing stalls this time.' });

    expect(res.status).toBe(201);
    expect((await prisma.application.findUniqueOrThrow({ where: { id: s.application.id } })).status).toBe('declined');
    const email = await prisma.emailNotification.findFirstOrThrow({ where: { type: 'application_declined' } });
    expect(email.payload).toMatchObject({ note: 'We have enough clothing stalls this time.' });
  });

  it('refuses to decide twice', async () => {
    const s = await setup();
    await decide(s, 'decline');

    const res = await decide(s, 'approve');

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('This application was already decided');
  });

  it("refuses an application of another event", async () => {
    const s = await setup();
    const otherEvent = await readyEvent(prisma, s.organizer.profile.id, { status: 'open_to_vendors' });
    const vendor = await createVendor(prisma, [s.preloved.id]);
    const other = await submittedApplication(prisma, { eventId: otherEvent, vendorProfileId: vendor.profile.id, categoryId: s.preloved.id });

    expect((await decide(s, 'approve', {}, other.id)).status).toBe(404);
  });

  it('refuses decisions on a hidden event and by a suspended organizer', async () => {
    const s = await setup();
    await prisma.event.update({ where: { id: s.eventId }, data: { moderationState: 'hidden' } });
    const hidden = await decide(s, 'approve');
    expect(hidden.status).toBe(409);
    expect(hidden.body.message).toBe('This event is hidden by Creavent');

    await prisma.event.update({ where: { id: s.eventId }, data: { moderationState: 'visible' } });
    await prisma.userRole.update({ where: { userId_role: { userId: s.organizer.user.id, role: 'organizer' } }, data: { suspendedAt: new Date() } });
    expect((await decide(s, 'approve')).status).toBe(403);
  });

  it('can still review waiting applications after applications close', async () => {
    const s = await setup({ applicationsOpen: false });

    expect((await decide(s, 'approve')).status).toBe(201);
  });
});
