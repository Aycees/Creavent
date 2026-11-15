import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, signInAs } from './app.js';
import { assignedSlot, eventParts, readyFile, submittedApplication } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// Feature 3.3: assigning a slot (spec §5, §6.1, flow 6).
describe('assigning slots', () => {
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

  // An open event with an approved vendor who prefers B-01.
  async function setup(overrides: Parameters<typeof readyEvent>[2] = {}) {
    const organizer = await createOrganizer(prisma);
    const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', slotMode: 'vendor_preference', ...overrides });
    const parts = await eventParts(prisma, eventId);
    const vendor = await createVendor(prisma, [parts.preloved.id]);
    const application = await submittedApplication(prisma, {
      eventId,
      vendorProfileId: vendor.profile.id,
      categoryId: parts.preloved.id,
      preferredSlotId: parts.slots[2].id,
    });
    await prisma.application.update({ where: { id: application.id }, data: { status: 'approved' } });
    const browser = await signInAs(app, organizer.user.email);
    return { organizer, eventId, ...parts, vendor, application, browser };
  }

  type Setup = Awaited<ReturnType<typeof setup>>;
  const assign = (s: Setup, slotId: string, applicationId = s.application.id) =>
    s.browser.post(`/api/organizer/events/${s.eventId}/assignments`).send({ applicationId, slotIds: [slotId] });

  it('lists slots, the approved vendors with no slot, and who prefers which slot', async () => {
    const s = await setup();
    const other = await createVendor(prisma, [s.preloved.id]);
    await submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: other.profile.id, categoryId: s.preloved.id, preferredSlotId: s.slots[2].id });

    const res = await s.browser.get(`/api/organizer/events/${s.eventId}/vendors`);

    expect(res.status).toBe(200);
    expect(res.body.glance).toEqual({ open: 3, assigned: 0, reserved: 0, overdue: 0, setAside: 0 });
    expect(res.body.slots.map((x: { label: string; state: string; preferredBy: number; price: number }) => [x.label, x.state, x.preferredBy, x.price])).toEqual([
      ['A-01', 'open', 0, 800],
      ['A-02', 'open', 0, 800],
      ['B-01', 'open', 2, 1500],
    ]);
    expect(res.body.unassigned).toEqual([
      { applicationId: s.application.id, shopName: "Lola's Ukay", categories: ['Preloved clothing'], slotsRequested: 1, preferredSlots: [{ id: s.slots[2].id, label: 'B-01', state: 'open' }] },
    ]);
    expect(res.body.event).toMatchObject({ waitingApplications: 1, deadlineHours: 24 });
  });

  it('assigns a slot: locks the price and payment options, sets the deadline, and emails the vendor', async () => {
    const s = await setup();
    const before = Date.now();

    const res = await assign(s, s.slots[2].id);

    expect(res.status).toBe(201);
    const assignment = await prisma.slotAssignment.findFirstOrThrow({ where: { applicationId: s.application.id }, include: { payment: true, slots: true } });
    expect(assignment.slots).toMatchObject([{ slotId: s.slots[2].id, active: true }]);
    expect(assignment).toMatchObject({ status: 'assigned', vendorProfileId: s.vendor.profile.id, assignedById: s.organizer.user.id });
    expect(Number(assignment.priceLocked)).toBe(1500);
    expect(assignment.paymentInstructionsSnapshot).toEqual([
      expect.objectContaining({ channel: 'gcash', label: 'GCash, Rhea M.', accountNumber: '0917 482 1093' }),
    ]);
    const hours = (assignment.deadlineAt.getTime() - before) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThan(24.1);
    expect(assignment.payment).toMatchObject({ status: 'pending', payerUserId: s.vendor.user.id, payeeUserId: s.organizer.user.id, currency: 'PHP' });
    expect(Number(assignment.payment!.amountDue)).toBe(1500);
    expect(await prisma.auditLog.count({ where: { entityId: assignment.id, action: 'assignment.assign' } })).toBe(1);
    const email = await prisma.emailNotification.findFirstOrThrow({ where: { type: 'slot_assigned' } });
    expect(email).toMatchObject({ toEmail: s.vendor.user.email, relatedEntityId: s.application.id });
    expect(email.payload).toMatchObject({ slotLabel: 'B-01', amount: '₱1,500', eventName: s.event.name });
    expect(res.body.glance).toMatchObject({ open: 2, assigned: 1 });
    expect(res.body.unassigned).toEqual([]);
    expect(res.body.assignments[0]).toMatchObject({ slotLabel: 'B-01', shopName: "Lola's Ukay", amountDue: 1500, paymentStatus: 'pending', overdue: false });
  });

  it('never sets a deadline after the event starts', async () => {
    const startsAt = new Date(Date.now() + 2 * 3_600_000);
    const s = await setup({ startsAt, endsAt: new Date(startsAt.getTime() + 86_400_000 + 60_000) });

    await assign(s, s.slots[0].id);

    const assignment = await prisma.slotAssignment.findFirstOrThrow({ where: { applicationId: s.application.id } });
    expect(assignment.deadlineAt.toISOString()).toBe(startsAt.toISOString());
  });

  it('keeps the locked price when the slot price changes later', async () => {
    const s = await setup();
    await assign(s, s.slots[2].id);

    await prisma.slot.update({ where: { id: s.slots[2].id }, data: { price: 2000 } });

    const res = await s.browser.get(`/api/organizer/events/${s.eventId}/vendors`);
    expect(res.body.assignments[0].amountDue).toBe(1500);
  });

  it('needs an approved application', async () => {
    const s = await setup();
    await prisma.application.update({ where: { id: s.application.id }, data: { status: 'submitted' } });

    const res = await assign(s, s.slots[0].id);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Approve the application before assigning a slot');
  });

  it('refuses a taken slot and a second slot for the same vendor', async () => {
    const s = await setup();
    await assign(s, s.slots[0].id);
    const other = await createVendor(prisma, [s.preloved.id]);
    const otherApp = await submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: other.profile.id, categoryId: s.preloved.id });
    await prisma.application.update({ where: { id: otherApp.id }, data: { status: 'approved' } });

    const taken = await assign(s, s.slots[0].id, otherApp.id);
    expect(taken.status).toBe(409);
    expect(taken.body.message).toBe('This slot is taken. Pick another.');

    const second = await assign(s, s.slots[1].id);
    expect(second.status).toBe(409);
    expect(second.body.message).toBe('This vendor already has a slot. Remove them from it first.');
  });

  it('lets the database refuse a second active assignment for a slot or a vendor', async () => {
    const s = await setup();
    const base = { eventId: s.eventId, categoryId: s.preloved.id, organizerUserId: s.organizer.user.id };
    const a = await createVendor(prisma, [s.preloved.id]);
    const b = await createVendor(prisma, [s.preloved.id]);
    await assignedSlot(prisma, { ...base, vendorProfileId: a.profile.id, slotId: s.slots[0].id });

    await expect(assignedSlot(prisma, { ...base, vendorProfileId: b.profile.id, slotId: s.slots[0].id })).rejects.toThrow();
    const app2 = await prisma.application.findFirstOrThrow({ where: { vendorProfileId: a.profile.id } });
    await expect(
      prisma.slotAssignment.create({
        data: {
          slots: { create: [{ slotId: s.slots[1].id, priceLocked: 800 }] },
          eventId: s.eventId,
          applicationId: app2.id,
          vendorProfileId: a.profile.id,
          priceLocked: 800,
          assignedAt: new Date(),
          assignedById: s.organizer.user.id,
          deadlineAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it('refuses a removed slot or one of another event', async () => {
    const s = await setup();
    const otherEvent = await eventParts(prisma, await readyEvent(prisma, s.organizer.profile.id, { status: 'open_to_vendors' }));
    await prisma.slot.update({ where: { id: s.slots[1].id }, data: { deletedAt: new Date() } });

    expect((await assign(s, s.slots[1].id)).status).toBe(404);
    expect((await assign(s, otherEvent.slots[0].id)).status).toBe(404);
  });

  it("refuses another organizer, a hidden event, and an application of another event", async () => {
    const s = await setup();
    const stranger = await createOrganizer(prisma);
    const strangerBrowser = await signInAs(app, stranger.user.email);
    expect((await strangerBrowser.post(`/api/organizer/events/${s.eventId}/assignments`).send({ applicationId: s.application.id, slotIds: [s.slots[0].id] })).status).toBe(404);
    expect((await strangerBrowser.get(`/api/organizer/events/${s.eventId}/vendors`)).status).toBe(404);

    const otherEvent = await readyEvent(prisma, s.organizer.profile.id, { status: 'open_to_vendors' });
    const v = await createVendor(prisma, [s.preloved.id]);
    const elsewhere = await submittedApplication(prisma, { eventId: otherEvent, vendorProfileId: v.profile.id, categoryId: s.preloved.id });
    expect((await assign(s, s.slots[0].id, elsewhere.id)).status).toBe(404);

    await prisma.event.update({ where: { id: s.eventId }, data: { moderationState: 'hidden' } });
    expect((await assign(s, s.slots[0].id)).status).toBe(409);
  });

  it("won't delete or rename an assigned slot", async () => {
    const s = await setup();
    await assign(s, s.slots[0].id);

    const del = await s.browser.delete(`/api/organizer/events/${s.eventId}/slots/${s.slots[0].id}`);
    expect(del.status).toBe(409);
    expect(del.body.message).toBe('A-01 has a vendor. Remove the vendor from it first.');

    const rename = await s.browser.patch(`/api/organizer/events/${s.eventId}/slots/${s.slots[0].id}`).send({ label: 'Z-01', section: 'Main walkway', price: null, sizeLabel: null, note: null });
    expect(rename.status).toBe(409);

    const reprice = await s.browser.patch(`/api/organizer/events/${s.eventId}/slots/${s.slots[0].id}`).send({ label: 'A-01', section: 'Main walkway', price: 900, sizeLabel: '2 × 2 m', note: null });
    expect(reprice.status).toBe(200);
  });

  it('shows the slot as taken to vendors, and counts it on the event page', async () => {
    const s = await setup();
    await assign(s, s.slots[0].id);
    const other = await createVendor(prisma, [s.preloved.id]);
    const browser = await signInAs(app, other.user.email);

    const form = await browser.get(`/api/vendor/events/${s.event.slug}/apply`);
    const page = await browser.get(`/api/events/${s.event.slug}`);

    expect(form.body.slotGroups[0].slots[0]).toMatchObject({ label: 'A-01', taken: true });
    expect(page.body.event.slotGroups[0]).toMatchObject({ name: 'Main walkway', open: 1, total: 2 });
    const refused = await browser.post(`/api/vendor/events/${s.event.slug}/applications`).send({
      categoryIds: [s.preloved.id],
      documents: [{ requirementId: s.clearance.id, fileIds: [(await readyFile(prisma, other.user.id)).id] }],
      preferredSlotIds: [s.slots[0].id],
    });
    expect(refused.status).toBe(400);
  });

  it('lets a vendor with a slot open the payment QR, and no other vendor', async () => {
    const s = await setup();
    const qr = await readyFile(prisma, s.organizer.user.id, 'payment_qr');
    await prisma.eventPaymentMethod.updateMany({ where: { eventId: s.eventId }, data: { qrFileId: qr.id } });
    await assign(s, s.slots[0].id);
    const mine = await signInAs(app, s.vendor.user.email);
    const other = await createVendor(prisma, [s.preloved.id]);
    const theirs = await signInAs(app, other.user.email);

    expect((await mine.get(`/api/files/${qr.id}`)).status).toBe(302);
    expect((await theirs.get(`/api/files/${qr.id}`)).status).toBe(404);
  });

  it('flags an assigned slot as overdue once the deadline passes without approved payment', async () => {
    const s = await setup();
    await assignedSlot(prisma, {
      eventId: s.eventId,
      vendorProfileId: (await createVendor(prisma, [s.preloved.id])).profile.id,
      categoryId: s.preloved.id,
      slotId: s.slots[1].id,
      organizerUserId: s.organizer.user.id,
      deadlineAt: new Date(Date.now() - 60_000),
    });

    const res = await s.browser.get(`/api/organizer/events/${s.eventId}/vendors`);

    expect(res.body.glance).toEqual({ open: 2, assigned: 1, reserved: 0, overdue: 1, setAside: 0 });
    expect(res.body.assignments[0].overdue).toBe(true);
    expect(res.body.slots.find((x: { label: string }) => x.label === 'A-02')).toMatchObject({ state: 'assigned', overdue: true });
  });
});
