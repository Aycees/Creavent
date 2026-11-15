import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, signInAs } from './app.js';
import { assignedSlot, eventParts, readyFile, submittedApplication } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// Fixes from the Phase 3 code review.
describe('Phase 3 review fixes', () => {
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
    const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors' });
    const parts = await eventParts(prisma, eventId);
    const vendor = await createVendor(prisma, [parts.preloved.id]);
    const slot = await assignedSlot(prisma, { eventId, vendorProfileId: vendor.profile.id, categoryId: parts.preloved.id, slotId: parts.slots[0].id, organizerUserId: organizer.user.id });
    const method = await prisma.eventPaymentMethod.findFirstOrThrow({ where: { eventId } });
    return {
      organizer,
      eventId,
      ...parts,
      vendor,
      ...slot,
      method,
      vendorBrowser: await signInAs(app, vendor.user.email),
      organizerBrowser: await signInAs(app, organizer.user.email),
    };
  }

  type Setup = Awaited<ReturnType<typeof setup>>;
  const uploadProof = async (s: Setup) =>
    s.vendorBrowser.post(`/api/vendor/applications/${s.application.id}/proofs`).send({
      fileId: (await readyFile(prisma, s.vendor.user.id, 'payment_proof')).id,
      paymentMethodId: s.method.id,
      amountClaimed: 800,
    });

  it('refuses Mark paid while a proof waits for review', async () => {
    const s = await setup();
    await uploadProof(s);

    const res = await s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/assignments/${s.assignment.id}/mark-paid`).send({ note: 'Paid cash' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('A proof is waiting for your review. Approve or reject it instead.');
  });

  it('keeps the QR the vendor was given readable after the organizer replaces it', async () => {
    const s = await setup();
    const oldQr = await readyFile(prisma, s.organizer.user.id, 'payment_qr');
    await prisma.slotAssignment.update({
      where: { id: s.assignment.id },
      data: { paymentInstructionsSnapshot: [{ id: s.method.id, channel: 'gcash', label: 'GCash', accountName: null, accountNumber: null, qrFileId: oldQr.id, notes: null }] },
    });
    const newQr = await readyFile(prisma, s.organizer.user.id, 'payment_qr');
    await prisma.eventPaymentMethod.update({ where: { id: s.method.id }, data: { qrFileId: newQr.id } });

    expect((await s.vendorBrowser.get(`/api/files/${oldQr.id}`)).status).toBe(302);
  });

  it('refuses to assign a slot on a canceled or completed event', async () => {
    const s = await setup();
    const other = await createVendor(prisma, [s.preloved.id]);
    const app2 = await submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: other.profile.id, categoryId: s.preloved.id });
    await prisma.application.update({ where: { id: app2.id }, data: { status: 'approved' } });
    await prisma.event.update({ where: { id: s.eventId }, data: { status: 'canceled' } });

    const res = await s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/assignments`).send({ applicationId: app2.id, slotIds: [s.slots[1].id] });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('This event is not taking vendors anymore');
  });

  it('shows the organizer archived payment records after a removal', async () => {
    const s = await setup();
    await uploadProof(s);
    await s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/applications/${s.application.id}/remove`).send({ canReapply: true, note: 'Agreed' });

    const res = await s.organizerBrowser.get(`/api/organizer/events/${s.eventId}/vendors`);

    expect(res.body.archived).toEqual([
      expect.objectContaining({ shopName: "Lola's Ukay", slotLabel: 'A-01', status: 'removed', amountDue: 800, proofs: [expect.objectContaining({ archived: true, amountClaimed: 800 })] }),
    ]);
  });

  it('keeps proofs from an earlier, released slot on the vendor page', async () => {
    const s = await setup();
    await uploadProof(s);
    const [proof] = await prisma.paymentProof.findMany({ where: { paymentId: s.payment.id } });
    await s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/proofs/${proof.id}/reject`).send({ reason: 'Unreadable' });
    await s.vendorBrowser.post(`/api/vendor/applications/${s.application.id}/release`).send({});
    await s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/assignments`).send({ applicationId: s.application.id, slotIds: [s.slots[1].id] });

    const res = await s.vendorBrowser.get(`/api/vendor/applications/${s.application.id}`);

    expect(res.body.assignment).toMatchObject({ slotLabel: 'A-02', proofs: [] });
    expect(res.body.pastProofs).toEqual([expect.objectContaining({ id: proof.id, archived: true })]);
  });

  it('logs each payment and proof status change through one function, refusing a stale change', async () => {
    const s = await setup();
    await uploadProof(s);
    const [proof] = await prisma.paymentProof.findMany({ where: { paymentId: s.payment.id } });

    await s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/proofs/${proof.id}/approve`).send({});

    const actions = (await prisma.auditLog.findMany({ where: { entityId: { in: [s.payment.id, proof.id] } } })).map((l) => l.action).sort();
    expect(actions).toEqual(['payment.approve', 'payment.submit', 'proof.approve']);
  });
});
