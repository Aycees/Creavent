import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, signInAs } from './app.js';
import { assignedSlot, eventParts, readyFile } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// Feature 3.5: pay and confirm (spec §6.2 to §6.5, flow 7).
describe('paying and confirming', () => {
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

  // A vendor with slot B-01 assigned at ₱1,500, payment pending.
  async function setup() {
    const organizer = await createOrganizer(prisma);
    const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors' });
    const parts = await eventParts(prisma, eventId);
    const vendor = await createVendor(prisma, [parts.preloved.id]);
    const slot = await assignedSlot(prisma, {
      eventId,
      vendorProfileId: vendor.profile.id,
      categoryId: parts.preloved.id,
      slotId: parts.slots[2].id,
      organizerUserId: organizer.user.id,
      price: 1500,
    });
    const method = await prisma.eventPaymentMethod.findFirstOrThrow({ where: { eventId } });
    const vendorBrowser = await signInAs(app, vendor.user.email);
    const organizerBrowser = await signInAs(app, organizer.user.email);
    return { organizer, eventId, ...parts, vendor, ...slot, method, vendorBrowser, organizerBrowser };
  }

  type Setup = Awaited<ReturnType<typeof setup>>;

  async function upload(s: Setup, body: Record<string, unknown> = {}) {
    const file = await readyFile(prisma, s.vendor.user.id, 'payment_proof');
    return s.vendorBrowser.post(`/api/vendor/applications/${s.application.id}/proofs`).send({
      fileId: file.id,
      paymentMethodId: s.method.id,
      amountClaimed: 1500,
      referenceNumber: '7012 345 678901',
      ...body,
    });
  }

  const proofsOf = (s: Setup) => prisma.paymentProof.findMany({ where: { paymentId: s.payment.id }, orderBy: { uploadedAt: 'asc' } });

  describe('the vendor uploads proof', () => {
    it('submits the payment and emails the organizer', async () => {
      const s = await setup();

      const res = await upload(s);

      expect(res.status).toBe(201);
      const [proof] = await proofsOf(s);
      expect(proof).toMatchObject({ status: 'submitted', paymentMethodId: s.method.id, referenceNumber: '7012 345 678901', uploadedById: s.vendor.user.id });
      expect(Number(proof.amountClaimed)).toBe(1500);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: s.payment.id } })).status).toBe('submitted');
      const email = await prisma.emailNotification.findFirstOrThrow({ where: { type: 'proof_uploaded' } });
      expect(email).toMatchObject({ userId: s.organizer.user.id });
      expect(email.payload).toMatchObject({ shopName: "Lola's Ukay", slotLabel: 'B-01', amount: '₱1,500' });
      expect(res.body.assignment.proofs).toHaveLength(1);
      expect(res.body.assignment.proofs[0]).toMatchObject({ status: 'submitted', methodLabel: 'GCash, Rhea M.', amountClaimed: 1500, fileUrl: `/api/files/${proof.fileId}` });
    });

    it('needs an option from the payment details the vendor was given', async () => {
      const s = await setup();
      const added = await prisma.eventPaymentMethod.create({ data: { eventId: s.eventId, channel: 'maya', label: 'Maya', sortOrder: 5 } });

      const res = await upload(s, { paymentMethodId: added.id });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Pick one of the payment options you were given');
    });

    it("refuses a file that isn't the vendor's ready proof image", async () => {
      const s = await setup();
      const doc = await readyFile(prisma, s.vendor.user.id, 'application_document');

      expect((await upload(s, { fileId: doc.id })).status).toBe(400);
    });

    it('refuses a second proof while one waits for review', async () => {
      const s = await setup();
      await upload(s);

      const res = await upload(s);

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Your proof is waiting for the organizer. You can upload again if they reject it.');
    });

    it("is Not found for another vendor's application", async () => {
      const s = await setup();
      const other = await createVendor(prisma, [s.preloved.id]);
      const browser = await signInAs(app, other.user.email);
      const file = await readyFile(prisma, other.user.id, 'payment_proof');

      const res = await browser.post(`/api/vendor/applications/${s.application.id}/proofs`).send({ fileId: file.id, paymentMethodId: s.method.id, amountClaimed: 1500 });

      expect(res.status).toBe(404);
    });
  });

  describe('the organizer reviews it', () => {
    it('shows the proof in the review panel data', async () => {
      const s = await setup();
      await upload(s);

      const res = await s.organizerBrowser.get(`/api/organizer/events/${s.eventId}/vendors`);

      expect(res.body.assignments[0]).toMatchObject({ paymentStatus: 'submitted', proof: { status: 'submitted', methodLabel: 'GCash, Rhea M.', amountClaimed: 1500, referenceNumber: '7012 345 678901' } });
    });

    it('approves: the slot is reserved, and the vendor is emailed', async () => {
      const s = await setup();
      await upload(s);
      const [proof] = await proofsOf(s);

      const res = await s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/proofs/${proof.id}/approve`).send({});

      expect(res.status).toBe(201);
      expect((await prisma.paymentProof.findUniqueOrThrow({ where: { id: proof.id } })).status).toBe('approved');
      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: s.payment.id } });
      expect(payment).toMatchObject({ status: 'approved', method: 'proof_upload', decidedById: s.organizer.user.id });
      expect(Number(payment.amountPaid)).toBe(1500);
      const assignment = await prisma.slotAssignment.findUniqueOrThrow({ where: { id: s.assignment.id } });
      expect(assignment.status).toBe('reserved');
      expect(assignment.reservedAt).not.toBeNull();
      expect(await prisma.emailNotification.count({ where: { type: 'payment_approved', toEmail: s.vendor.user.email } })).toBe(1);
      expect(res.body.glance).toMatchObject({ reserved: 1, assigned: 0 });
    });

    it('rejects with a reason; the vendor can upload new proof', async () => {
      const s = await setup();
      await upload(s, { amountClaimed: 1400 });
      const [proof] = await proofsOf(s);

      const missing = await s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/proofs/${proof.id}/reject`).send({ reason: '' });
      expect(missing.status).toBe(400);
      const res = await s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/proofs/${proof.id}/reject`).send({ reason: 'Short by ₱100' });

      expect(res.status).toBe(201);
      expect(await prisma.paymentProof.findUniqueOrThrow({ where: { id: proof.id } })).toMatchObject({ status: 'rejected', rejectionReason: 'Short by ₱100' });
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: s.payment.id } })).status).toBe('rejected');
      const email = await prisma.emailNotification.findFirstOrThrow({ where: { type: 'payment_rejected' } });
      expect(email.payload).toMatchObject({ reason: 'Short by ₱100' });
      expect((await upload(s)).status).toBe(201);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: s.payment.id } })).status).toBe('submitted');
    });

    it('marks paid without a proof, with a required note', async () => {
      const s = await setup();
      const path = `/api/organizer/events/${s.eventId}/assignments/${s.assignment.id}/mark-paid`;

      expect((await s.organizerBrowser.post(path).send({ note: '' })).status).toBe(400);
      const res = await s.organizerBrowser.post(path).send({ note: 'Paid cash at the office' });

      expect(res.status).toBe(201);
      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: s.payment.id } });
      expect(payment).toMatchObject({ status: 'approved', method: 'cash', decisionNote: 'Paid cash at the office' });
      expect((await prisma.slotAssignment.findUniqueOrThrow({ where: { id: s.assignment.id } })).status).toBe('reserved');
      expect(await prisma.emailNotification.count({ where: { type: 'payment_approved' } })).toBe(1);
    });

    it('refuses to decide a proof twice, or after the slot is reserved', async () => {
      const s = await setup();
      await upload(s);
      const [proof] = await proofsOf(s);
      await s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/proofs/${proof.id}/approve`).send({});

      expect((await s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/proofs/${proof.id}/reject`).send({ reason: 'x' })).status).toBe(409);
      expect((await s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/assignments/${s.assignment.id}/mark-paid`).send({ note: 'x' })).status).toBe(409);
      expect((await upload(s)).status).toBe(409);
    });

    it('lets only the event organizer see or decide, and refuses on a hidden event', async () => {
      const s = await setup();
      await upload(s);
      const [proof] = await proofsOf(s);
      const stranger = await createOrganizer(prisma);
      const strangerBrowser = await signInAs(app, stranger.user.email);

      expect((await strangerBrowser.post(`/api/organizer/events/${s.eventId}/proofs/${proof.id}/approve`).send({})).status).toBe(404);
      expect((await strangerBrowser.get(`/api/files/${proof.fileId}`)).status).toBe(404);
      expect((await s.organizerBrowser.get(`/api/files/${proof.fileId}`)).status).toBe(302);
      expect((await s.vendorBrowser.get(`/api/files/${proof.fileId}`)).status).toBe(302);

      await prisma.event.update({ where: { id: s.eventId }, data: { moderationState: 'hidden' } });
      expect((await s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/proofs/${proof.id}/approve`).send({})).status).toBe(409);
    });
  });
});
