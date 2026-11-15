import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { formatPeso, type PaymentInstruction, type Proof, type uploadProofSchema } from '@creavent/shared';
import type { z } from 'zod';
import { appConfig } from '../config.js';
import { ownEvent } from '../events/organizer-events.service.js';
import type { EventPaymentMethod, File, Payment, PaymentProof, Prisma } from '../generated/prisma/client.js';
import { assertAttachable, FilesService } from '../files/files.service.js';
import { OutboxService } from '../notifications/outbox.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { changeAssignmentStatus } from './assignment-status.js';
import { changePaymentStatus, changeProofStatus } from './payment-status.js';
import { assertVisible } from './organizer-applications.service.js';
import { vendorProfile } from './vendor-profile.js';

// Proof of payment and the organizer's decision (spec §6.2 to §6.4).
// Creavent never handles the money: these only track what each side says.
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly outbox: OutboxService,
  ) {}

  async uploadProof(userId: string, applicationId: string, input: z.output<typeof uploadProofSchema>) {
    await this.prisma.$transaction(async (tx) => {
      const vendor = await vendorProfile(tx, userId);
      const application = await tx.application.findFirst({ where: { id: applicationId, vendorProfileId: vendor.id }, select: { eventId: true } });
      if (!application) throw new NotFoundException('Application not found');
      // Serialize with the organizer's decisions on this event.
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${application.eventId}::uuid FOR UPDATE`;
      const assignment = await tx.slotAssignment.findFirst({
        where: { applicationId, status: { in: ['assigned', 'reserved'] } },
        include: { payment: true, slot: true, event: { include: { organizerProfile: { include: { user: { include: { roles: { where: { role: 'organizer' } } } } } } } } },
      });
      if (!assignment?.payment) throw new ConflictException('You have no slot to pay for here');
      assertVisible(assignment.event);
      const payment = assignment.payment;
      if (assignment.status === 'reserved' || payment.status === 'approved') throw new ConflictException('Your payment is already approved');
      if (payment.status === 'submitted') {
        throw new ConflictException('Your proof is waiting for the organizer. You can upload again if they reject it.');
      }
      const options = (assignment.paymentInstructionsSnapshot ?? []) as PaymentInstruction[];
      if (!options.some((o) => o.id === input.paymentMethodId)) throw new BadRequestException('Pick one of the payment options you were given');
      await assertAttachable(tx, input.fileId, userId, 'payment_proof');
      if (await tx.paymentProof.findFirst({ where: { fileId: input.fileId } })) throw new BadRequestException('This file cannot be used here');

      const proof = await tx.paymentProof.create({
        data: {
          paymentId: payment.id,
          eventId: assignment.eventId,
          vendorProfileId: vendor.id,
          uploadedById: userId,
          fileId: input.fileId,
          paymentMethodId: input.paymentMethodId,
          amountClaimed: input.amountClaimed,
          referenceNumber: input.referenceNumber,
          note: input.note,
        },
      });
      await changePaymentStatus(tx, { paymentId: payment.id, from: payment.status, action: 'submit', actorUserId: userId, reason: `Proof ${proof.id}` });
      const organizer = assignment.event.organizerProfile.user;
      const config = appConfig();
      await this.outbox.queue(tx, {
        userId: organizer.id,
        toEmail: organizer.roles[0]?.contactEmail ?? organizer.email,
        type: 'proof_uploaded',
        payload: {
          name: organizer.fullName,
          shopName: vendor.shopName,
          eventName: assignment.event.name,
          slotLabel: assignment.slot.label,
          amount: formatPeso(Number(payment.amountDue)),
          url: `${config.webUrl}/organizer/events/${assignment.eventId}/vendors`,
          supportEmail: config.supportEmail,
        },
        relatedEntityType: 'payment',
        relatedEntityId: payment.id,
      });
    });
  }

  async approveProof(userId: string, eventId: string, proofId: string, amountPaid: number | null) {
    await this.prisma.$transaction(async (tx) => {
      const { proof, assignment } = await this.waitingProof(tx, userId, eventId, proofId);
      await changeProofStatus(tx, { proofId: proof.id, action: 'approve', actorUserId: userId, data: { decidedById: userId, decidedAt: new Date() } });
      await this.approvePayment(tx, userId, assignment, {
        method: 'proof_upload',
        amountPaid: amountPaid ?? (proof.amountClaimed === null ? Number(assignment.payment.amountDue) : Number(proof.amountClaimed)),
        note: null,
      });
    });
  }

  async rejectProof(userId: string, eventId: string, proofId: string, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      const { proof, assignment } = await this.waitingProof(tx, userId, eventId, proofId);
      const now = new Date();
      await changeProofStatus(tx, { proofId: proof.id, action: 'reject', actorUserId: userId, data: { decidedById: userId, decidedAt: now, rejectionReason: reason }, reason });
      await changePaymentStatus(tx, {
        paymentId: assignment.payment.id,
        from: assignment.payment.status,
        action: 'reject',
        actorUserId: userId,
        data: { decidedById: userId, decidedAt: now },
        reason,
      });
      await this.emailVendor(tx, assignment, 'payment_rejected', { reason });
    });
  }

  // "Mark paid": approve without a proof image, with a note (spec §6.3).
  async markPaid(userId: string, eventId: string, assignmentId: string, note: string, method: 'cash' | 'other') {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      assertVisible(event);
      const assignment = await tx.slotAssignment.findFirst({ where: { id: assignmentId, eventId }, include: assignmentInclude });
      if (!assignment?.payment) throw new NotFoundException('Slot not found');
      if (assignment.status !== 'assigned' || assignment.payment.status === 'approved' || assignment.payment.archivedAt) {
        throw new ConflictException('This payment is already approved, or the vendor no longer has this slot');
      }
      // A waiting proof is decided with approve or reject, so it isn't left
      // in "proofs to check" (spec §6.3).
      if (assignment.payment.status === 'submitted') {
        throw new ConflictException('A proof is waiting for your review. Approve or reject it instead.');
      }
      await this.approvePayment(tx, userId, { ...assignment, payment: assignment.payment }, { method, amountPaid: Number(assignment.payment.amountDue), note });
    });
  }

  // The organizer's own event, and a proof of it that still waits for review.
  private async waitingProof(tx: Tx, userId: string, eventId: string, proofId: string) {
    const event = await ownEvent(tx, userId, eventId);
    assertVisible(event);
    const proof = await tx.paymentProof.findFirst({ where: { id: proofId, eventId } });
    if (!proof) throw new NotFoundException('Proof not found');
    const assignment = await tx.slotAssignment.findFirst({ where: { payment: { id: proof.paymentId } }, include: assignmentInclude });
    if (proof.status !== 'submitted' || proof.archivedAt || !assignment?.payment || assignment.status !== 'assigned') {
      throw new ConflictException('This proof was already reviewed');
    }
    return { proof, assignment: { ...assignment, payment: assignment.payment } };
  }

  private async approvePayment(
    tx: Tx,
    userId: string,
    assignment: AssignmentWithPayment,
    input: { method: 'proof_upload' | 'cash' | 'other'; amountPaid: number; note: string | null },
  ) {
    const now = new Date();
    await changePaymentStatus(tx, {
      paymentId: assignment.payment.id,
      from: assignment.payment.status,
      action: 'approve',
      actorUserId: userId,
      data: { method: input.method, amountPaid: input.amountPaid, decidedById: userId, decidedAt: now, decisionNote: input.note },
      reason: input.note,
    });
    await changeAssignmentStatus(tx, { assignmentId: assignment.id, from: 'assigned', action: 'reserve', actorUserId: userId, data: { reservedAt: now } });
    await this.emailVendor(tx, assignment, 'payment_approved', {});
  }

  private async emailVendor(tx: Tx, a: AssignmentWithPayment, type: 'payment_approved' | 'payment_rejected', extra: Record<string, string>) {
    const vendor = a.vendorProfile.user;
    const config = appConfig();
    await this.outbox.queue(tx, {
      userId: vendor.id,
      toEmail: vendor.email,
      type,
      payload: {
        name: vendor.fullName,
        eventName: a.event.name,
        slotLabel: a.slot.label,
        amount: formatPeso(Number(a.payment.amountDue)),
        ...extra,
        url: `${config.webUrl}/vendor/applications/${a.applicationId}`,
        supportEmail: config.supportEmail,
      },
      relatedEntityType: 'payment',
      relatedEntityId: a.payment.id,
    });
  }

  // A proof as both sides see it.
  toProof(p: PaymentProof & { paymentMethod: EventPaymentMethod; file: File }): Proof {
    return {
      id: p.id,
      status: p.status,
      uploadedAt: p.uploadedAt.toISOString(),
      fileUrl: this.files.fileUrl(p.file),
      methodLabel: p.paymentMethod.label,
      methodAccount: p.paymentMethod.accountNumber,
      amountClaimed: p.amountClaimed === null ? null : Number(p.amountClaimed),
      referenceNumber: p.referenceNumber,
      note: p.note,
      rejectionReason: p.rejectionReason,
      archived: p.archivedAt !== null,
    };
  }
}

const assignmentInclude = { payment: true, slot: true, event: true, vendorProfile: { include: { user: true } } } satisfies Prisma.SlotAssignmentInclude;
type AssignmentWithPayment = Prisma.SlotAssignmentGetPayload<{ include: typeof assignmentInclude }> & { payment: Payment };
