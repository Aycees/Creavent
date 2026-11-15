import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { formatPeso, type EventVendors, type PaymentInstruction } from '@creavent/shared';
import { writeAuditLog } from '../audit/audit-log.js';
import { appConfig } from '../config.js';
import { organizerProfile, ownEvent } from '../events/organizer-events.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { OutboxService } from '../notifications/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertVisible } from './organizer-applications.service.js';
import { PaymentsService } from './payments.service.js';
import { changeApplicationStatus } from './application-status.js';
import { archivePayment, changeAssignmentStatus } from './assignment-status.js';
import { ACTIVE, isOverdue } from './slot-status.js';

// The organizer's Vendors and slots page (spec §3.4, §5, sitemap §4).
@Injectable()
export class OrganizerVendorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly payments: PaymentsService,
  ) {}

  async vendors(userId: string, eventId: string): Promise<EventVendors> {
    await organizerProfile(this.prisma, userId);
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organizerProfile: { userId } },
      include: { slots: { where: { deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] } },
    });
    if (!event) throw new NotFoundException('Event not found');
    const ended = await this.prisma.slotAssignment.findMany({
      where: { eventId, status: { in: ['released', 'removed', 'canceled'] }, payment: { proofs: { some: {} } } },
      include: {
        slot: true,
        vendorProfile: true,
        payment: { include: { proofs: { orderBy: { uploadedAt: 'desc' }, include: { paymentMethod: true, file: true } } } },
      },
      orderBy: { endedAt: 'desc' },
    });
    const [assignments, approved, waiting] = await Promise.all([
      this.prisma.slotAssignment.findMany({
        where: { eventId, status: { in: [...ACTIVE] } },
        include: {
          slot: true,
          payment: { include: { proofs: { orderBy: { uploadedAt: 'desc' }, take: 1, include: { paymentMethod: true, file: true } } } },
          vendorProfile: { include: { user: true } },
        },
        orderBy: { slot: { sortOrder: 'asc' } },
      }),
      this.prisma.application.findMany({
        where: { eventId, status: 'approved', assignments: { none: { status: { in: [...ACTIVE] } } } },
        include: { vendorProfile: true, categories: { include: { category: true } }, preferredSlot: true },
        orderBy: { decidedAt: 'asc' },
      }),
      this.prisma.application.findMany({ where: { eventId, status: { in: ['submitted', 'approved'] }, preferredSlotId: { not: null } }, select: { id: true, preferredSlotId: true } }),
    ]);
    const now = new Date();
    const bySlot = new Map(assignments.map((a) => [a.slotId, a]));
    const assignedApps = new Set(assignments.map((a) => a.applicationId));
    // "Preferred by" counts waiting or approved applications without a slot.
    const preferredBy = new Map<string, number>();
    for (const w of waiting) if (!assignedApps.has(w.id)) preferredBy.set(w.preferredSlotId!, (preferredBy.get(w.preferredSlotId!) ?? 0) + 1);
    const fallback = event.defaultSlotPrice === null ? null : Number(event.defaultSlotPrice);
    const overdueCount = assignments.filter((a) => isOverdue(a, now)).length;
    return {
      event: {
        id: event.id,
        slug: event.slug,
        name: event.name,
        status: event.status,
        applicationsOpen: event.applicationsOpen,
        preferredSlots: event.slotMode === 'vendor_preference',
        deadlineHours: event.paymentDeadlineHours,
        waitingApplications: await this.prisma.application.count({ where: { eventId, status: 'submitted' } }),
      },
      glance: {
        open: event.slots.length - assignments.length,
        assigned: assignments.filter((a) => a.status === 'assigned').length,
        reserved: assignments.filter((a) => a.status === 'reserved').length,
        overdue: overdueCount,
      },
      slots: event.slots.map((s) => {
        const a = bySlot.get(s.id);
        return {
          id: s.id,
          label: s.label,
          section: s.section,
          sizeLabel: s.sizeLabel,
          price: s.price === null ? fallback : Number(s.price),
          state: a ? (a.status as 'assigned' | 'reserved') : 'open',
          overdue: a ? isOverdue(a, now) : false,
          preferredBy: a ? 0 : (preferredBy.get(s.id) ?? 0),
        };
      }),
      unassigned: approved.map((a) => ({
        applicationId: a.id,
        shopName: a.vendorProfile.shopName,
        categories: a.categories.map((c) => c.category.name),
        preferredSlot: a.preferredSlot
          ? { id: a.preferredSlot.id, label: a.preferredSlot.label, state: a.preferredSlot.deletedAt ? 'removed' : bySlot.has(a.preferredSlot.id) ? 'taken' : 'open' }
          : null,
      })),
      assignments: assignments.map((a) => ({
        id: a.id,
        applicationId: a.applicationId,
        status: a.status,
        slotLabel: a.slot.label,
        shopName: a.vendorProfile.shopName,
        phone: a.vendorProfile.user.phone,
        amountDue: Number(a.priceLocked),
        paymentStatus: a.payment?.status ?? 'pending',
        deadlineAt: a.deadlineAt.toISOString(),
        overdue: isOverdue(a, now),
        proof: a.payment?.proofs[0] ? this.payments.toProof(a.payment.proofs[0]) : null,
        paymentNote: a.payment?.method !== 'proof_upload' ? (a.payment?.decisionNote ?? null) : null,
      })),
      // Payment records of vendors who released or were removed: read-only,
      // and still readable for disputes (spec §6.6).
      archived: ended.map((a) => ({
        assignmentId: a.id,
        shopName: a.vendorProfile.shopName,
        slotLabel: a.slot.label,
        status: a.status,
        amountDue: Number(a.priceLocked),
        endedAt: a.endedAt?.toISOString() ?? null,
        proofs: (a.payment?.proofs ?? []).filter((p) => !p.file.deletedAt).map((p) => this.payments.toProof(p)),
      })),
    };
  }

  async assign(userId: string, eventId: string, applicationId: string, slotId: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const event = await ownEvent(tx, userId, eventId);
        assertVisible(event);
        if (event.status !== 'open_to_vendors' && event.status !== 'announced') {
          throw new ConflictException('This event is not taking vendors anymore');
        }
        const application = await tx.application.findFirst({
          where: { id: applicationId, eventId },
          include: { vendorProfile: { include: { user: true } } },
        });
        if (!application) throw new NotFoundException('Application not found');
        if (application.status !== 'approved') throw new ConflictException('Approve the application before assigning a slot');
        const slot = await tx.slot.findFirst({ where: { id: slotId, eventId, deletedAt: null } });
        if (!slot) throw new NotFoundException('Slot not found');
        if (await tx.slotAssignment.findFirst({ where: { slotId, status: { in: [...ACTIVE] } } })) {
          throw new ConflictException('This slot is taken. Pick another.');
        }
        if (await tx.slotAssignment.findFirst({ where: { eventId, vendorProfileId: application.vendorProfileId, status: { in: [...ACTIVE] } } })) {
          throw new ConflictException('This vendor already has a slot. Remove them from it first.');
        }
        const methods = await tx.eventPaymentMethod.findMany({ where: { eventId, isActive: true }, orderBy: { sortOrder: 'asc' } });
        const instructions: PaymentInstruction[] = methods.map((m) => ({
          id: m.id,
          channel: m.channel,
          label: m.label,
          accountName: m.accountName,
          accountNumber: m.accountNumber,
          qrFileId: m.qrFileId,
          notes: m.notes,
        }));
        const price = Number(slot.price ?? event.defaultSlotPrice ?? 0);
        const now = new Date();
        // Never past the opening of the first day (data model §6.7).
        const byHours = new Date(now.getTime() + event.paymentDeadlineHours * 3_600_000);
        const deadlineAt = event.startsAt && event.startsAt < byHours ? event.startsAt : byHours;
        const vendor = application.vendorProfile.user;
        const assignment = await tx.slotAssignment.create({
          data: {
            slotId,
            eventId,
            applicationId,
            vendorProfileId: application.vendorProfileId,
            priceLocked: price,
            paymentInstructionsSnapshot: instructions,
            assignedAt: now,
            assignedById: userId,
            deadlineAt,
            payment: { create: { eventId, payerUserId: vendor.id, payeeUserId: userId, amountDue: price } },
          },
        });
        await writeAuditLog(tx, {
          actorUserId: userId,
          action: 'assignment.assign',
          entityType: 'slot_assignment',
          entityId: assignment.id,
          changes: { status: { from: null, to: 'assigned' }, slot: slot.label, price },
        });
        const config = appConfig();
        await this.outbox.queue(tx, {
          userId: vendor.id,
          toEmail: vendor.email,
          type: 'slot_assigned',
          payload: {
            name: vendor.fullName,
            eventName: event.name,
            slotLabel: slot.label,
            amount: formatPeso(price),
            deadlineAt: deadlineAt.toISOString(),
            instructions: instructions.map((i) => [i.label, i.accountNumber].filter(Boolean).join(': ')),
            url: `${config.webUrl}/vendor/applications/${applicationId}`,
            supportEmail: config.supportEmail,
          },
          relatedEntityType: 'application',
          relatedEntityId: applicationId,
        });
      });
    } catch (error) {
      // Two assignments at once: a partial unique index refuses the second.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This slot or vendor was just assigned. Refresh and try again.');
      }
      throw error;
    }
    return this.vendors(userId, eventId);
  }

  // Remove an approved vendor at any time: their slot opens again and the
  // payment records are archived (spec §6.6). Allowed on a hidden event too.
  async remove(userId: string, eventId: string, applicationId: string, canReapply: boolean, note: string | null) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      const application = await tx.application.findFirst({
        where: { id: applicationId, eventId },
        include: { vendorProfile: { include: { user: true } }, assignments: { where: { status: { in: [...ACTIVE] } } } },
      });
      if (!application) throw new NotFoundException('Application not found');
      const now = new Date();
      await changeApplicationStatus(tx, {
        applicationId,
        from: application.status,
        action: 'remove',
        actorUserId: userId,
        data: { removedAt: now, removedById: userId, removalNote: note, canReapply },
        reason: note,
      });
      for (const a of application.assignments) {
        await changeAssignmentStatus(tx, {
          assignmentId: a.id,
          from: a.status,
          action: 'remove',
          actorUserId: userId,
          data: { endedAt: now, endedById: userId, endedReason: note ?? 'Removed by the organizer' },
        });
        await archivePayment(tx, a.id, now);
      }
      const vendor = application.vendorProfile.user;
      const config = appConfig();
      await this.outbox.queue(tx, {
        userId: vendor.id,
        toEmail: vendor.email,
        type: 'vendor_removed',
        payload: {
          name: vendor.fullName,
          eventName: event.name,
          note,
          canReapply,
          url: `${config.webUrl}/vendor/applications/${applicationId}`,
          supportEmail: config.supportEmail,
        },
        relatedEntityType: 'application',
        relatedEntityId: applicationId,
      });
    });
    return this.vendors(userId, eventId);
  }
}
