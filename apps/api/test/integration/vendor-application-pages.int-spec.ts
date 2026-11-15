import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, signInAs } from './app.js';
import { assignedSlot, eventParts, readyFile, submittedApplication } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// Feature 3.4: the vendor's application list and page (spec §4.6, §8.2).
describe("the vendor's application pages", () => {
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
    const organizer = await createOrganizer(prisma, { displayName: 'Balik-Gamit Davao' });
    await prisma.userRole.update({
      where: { userId_role: { userId: organizer.user.id, role: 'organizer' } },
      data: { contactEmail: 'rhea@balikgamit.ph' },
    });
    const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', slotMode: 'vendor_preference' });
    const parts = await eventParts(prisma, eventId);
    const vendor = await createVendor(prisma, [parts.preloved.id]);
    const browser = await signInAs(app, vendor.user.email);
    return { organizer, eventId, ...parts, vendor, browser };
  }

  it('lists the vendor’s applications with the combined status, slot, and payment', async () => {
    const s = await setup();
    const other = await readyEvent(prisma, s.organizer.profile.id, { status: 'open_to_vendors', name: 'Matina Night Flea' });
    const declined = await submittedApplication(prisma, { eventId: other, vendorProfileId: s.vendor.profile.id, categoryId: s.preloved.id });
    await prisma.application.update({ where: { id: declined.id }, data: { status: 'declined', decisionNote: 'Full this time' } });
    const { application } = await assignedSlot(prisma, {
      eventId: s.eventId,
      vendorProfileId: s.vendor.profile.id,
      categoryId: s.preloved.id,
      slotId: s.slots[2].id,
      organizerUserId: s.organizer.user.id,
      price: 1500,
    });

    const res = await s.browser.get('/api/vendor/applications');

    expect(res.status).toBe(200);
    const byId = new Map(res.body.applications.map((a: { id: string }) => [a.id, a]));
    expect(byId.get(application.id)).toMatchObject({ status: 'slot_assigned', slotLabel: 'B-01', amountDue: 1500, paymentStatus: 'pending', event: { name: s.event.name } });
    expect(byId.get(declined.id)).toMatchObject({ status: 'declined', decisionNote: 'Full this time', slotLabel: null });
  });

  it('shows a submitted application with the preferred slot and the organizer contact', async () => {
    const s = await setup();
    const application = await submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: s.vendor.profile.id, categoryId: s.preloved.id, preferredSlotId: s.slots[0].id });

    const res = await s.browser.get(`/api/vendor/applications/${application.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'submitted',
      categories: ['Preloved clothing'],
      preferredSlot: { label: 'A-01', state: 'open' },
      assignment: null,
      organizer: { displayName: 'Balik-Gamit Davao', phone: '+639171234567', contactEmail: 'rhea@balikgamit.ph', approved: true },
      event: { name: s.event.name, ingressInfo: null },
    });
  });

  it('shows the assigned slot, the locked amount, the payment options with the QR, and the ingress details', async () => {
    const s = await setup();
    const qr = await readyFile(prisma, s.organizer.user.id, 'payment_qr');
    await prisma.eventPaymentMethod.updateMany({ where: { eventId: s.eventId }, data: { qrFileId: qr.id } });
    const { application } = await assignedSlot(prisma, {
      eventId: s.eventId,
      vendorProfileId: s.vendor.profile.id,
      categoryId: s.preloved.id,
      slotId: s.slots[2].id,
      organizerUserId: s.organizer.user.id,
      price: 1500,
    });
    // Later changes don't move what the vendor was given.
    await prisma.eventPaymentMethod.updateMany({ where: { eventId: s.eventId }, data: { accountNumber: '0000' } });

    const res = await s.browser.get(`/api/vendor/applications/${application.id}`);

    expect(res.body.status).toBe('slot_assigned');
    expect(res.body.preferredSlot).toBeNull();
    expect(res.body.event.ingressInfo).toBe('From 1 PM, Gate 2');
    expect(res.body.assignment).toMatchObject({
      status: 'assigned',
      slotLabel: 'B-01',
      sizeLabel: '3 × 3 m',
      note: 'Near the gate',
      amountDue: 1500,
      paymentStatus: 'pending',
      instructions: [{ channel: 'gcash', label: 'GCash, Rhea M.', accountNumber: '0917 482 1093', qrUrl: `/api/files/${qr.id}` }],
    });
  });

  it("is Not found for another vendor's application", async () => {
    const s = await setup();
    const application = await submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: s.vendor.profile.id, categoryId: s.preloved.id });
    const other = await createVendor(prisma, [s.preloved.id]);
    const browser = await signInAs(app, other.user.email);

    expect((await browser.get(`/api/vendor/applications/${application.id}`)).status).toBe(404);
    expect((await browser.get('/api/vendor/applications')).body.applications).toEqual([]);
  });
});
