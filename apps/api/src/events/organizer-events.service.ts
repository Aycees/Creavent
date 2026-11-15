import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  manilaInstant,
  manilaParts,
  type createEventSchema,
  type eventDetailsSchema,
  type eventPaymentsSchema,
  type eventPolicySchema,
  paymentChannelLabels,
  type eventRequirementsSchema,
  type EventSetup,
  type OrganizerEventRow,
  type OrganizerEvents,
  type OrganizerTodo,
} from '@creavent/shared';
import type { z } from 'zod';
import { writeAuditLog } from '../audit/audit-log.js';
import { isOverdue } from '../applications/slot-status.js';
import { appConfig } from '../config.js';
import { assertStillReady, changeEventStatus, checklist, missingSteps, stepActions } from './event-status.js';
import { assertAttachable, FilesService, retireFiles } from '../files/files.service.js';
import { freeSlug } from '../onboarding/slugs.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';

type Db = Tx | PrismaService;

// Event setup for the event's organizer (spec §3.1, sitemap §4). Every save
// answers with the whole setup state, like the profile pages.
@Injectable()
export class OrganizerEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  eventTypes() {
    return this.prisma.eventType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, slug: true },
    });
  }

  async create(userId: string, input: z.output<typeof createEventSchema>) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await organizerProfile(tx, userId);
      await assertEventType(tx, input.eventTypeId);
      // Most organizers write their policy once (spec §3.7).
      const last = await tx.event.findFirst({
        where: { organizerProfileId: profile.id, policyText: { not: null } },
        orderBy: { createdAt: 'desc' },
      });
      const event = await tx.event.create({
        data: {
          organizerProfileId: profile.id,
          eventTypeId: input.eventTypeId,
          name: input.name,
          slug: await freeSlug(tx, 'event', input.name, userId),
          policyText: last?.policyText ?? null,
          policySourceEventId: last?.id ?? null,
          paymentDeadlineHours: appConfig().defaultPaymentDeadlineHours,
        },
      });
      return { id: event.id };
    });
  }

  // The organizer's events in Upcoming (not ended, or no dates yet) and Past,
  // each with its next step (spec §3.8).
  async list(userId: string): Promise<OrganizerEvents> {
    const profile = await organizerProfile(this.prisma, userId);
    const role = await this.prisma.userRole.findUniqueOrThrow({ where: { userId_role: { userId, role: 'organizer' } } });
    const events = await this.prisma.event.findMany({
      where: { organizerProfileId: profile.id },
      include: { eventType: true, _count: { select: { slots: { where: { deletedAt: null } } } } },
      orderBy: [{ startsAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    });
    const counts = await this.todoCounts(events.filter((e) => e.status === 'open_to_vendors' || e.status === 'announced'));
    // "Upcoming" runs until the end of the event's last day (flow 3).
    const startOfToday = new Date(`${manilaParts(new Date()).date}T00:00:00+08:00`);
    const rows = await Promise.all(
      events.map(async (e): Promise<OrganizerEventRow & { ended: boolean }> => {
        let nextStep: string;
        if (e.status === 'draft') {
          const list = await this.prisma.$transaction((tx) => checklist(tx, e.id));
          const missing = (Object.keys(stepActions) as (keyof typeof stepActions)[]).find((k) => !list[k]);
          nextStep = missing ? stepActions[missing] : isApproved(role) ? 'Open to vendors' : 'Get approved to open';
        } else if (e.status === 'open_to_vendors' && counts.get(e.id)?.todo.applicationsToReview) {
          const n = counts.get(e.id)!.todo.applicationsToReview;
          nextStep = `Review ${n} application${n === 1 ? '' : 's'}`;
        } else if (e.status === 'open_to_vendors') {
          nextStep = e.applicationsOpen ? 'Applications open' : 'Applications closed';
        } else {
          nextStep = { announced: 'Announced', completed: 'Completed', canceled: 'Canceled' }[e.status];
        }
        return {
          id: e.id,
          slug: e.slug,
          name: e.name,
          typeName: e.eventType.name,
          status: e.status,
          startDate: e.startsAt ? manilaParts(e.startsAt).date : null,
          endDate: e.endsAt ? manilaParts(e.endsAt).date : null,
          venueName: e.venueName,
          slotCount: e._count.slots,
          nextStep,
          fill: counts.get(e.id)?.fill ?? null,
          ended: e.endsAt !== null && e.endsAt < startOfToday,
        };
      }),
    );
    const strip = ({ ended: _ended, ...row }: OrganizerEventRow & { ended: boolean }) => row;
    const todo = rows
      .filter((r) => !r.ended && counts.has(r.id))
      .map((r) => ({ eventId: r.id, name: r.name, ...counts.get(r.id)!.todo }))
      .filter((t) => t.applicationsToReview + t.proofsToCheck + t.overduePayments + t.approvedNoSlot > 0);
    return { todo, upcoming: rows.filter((r) => !r.ended).map(strip), past: rows.filter((r) => r.ended).reverse().map(strip) };
  }

  // The dashboard's to-do counts and slot fill for open or announced events
  // (spec §3.8, data model §7).
  private async todoCounts(events: { id: string }[]) {
    const now = new Date();
    const result = new Map<string, { todo: Omit<OrganizerTodo, 'eventId' | 'name'>; fill: NonNullable<OrganizerEventRow['fill']> }>();
    for (const { id } of events) {
      const [waiting, oldest, proofs, assignments, approvedNoSlot, slots] = await Promise.all([
        this.prisma.application.count({ where: { eventId: id, status: 'submitted' } }),
        this.prisma.application.findFirst({ where: { eventId: id, status: 'submitted' }, orderBy: { submittedAt: 'asc' }, select: { submittedAt: true } }),
        this.prisma.paymentProof.findMany({ where: { eventId: id, status: 'submitted', archivedAt: null }, select: { payment: { select: { amountDue: true } } } }),
        this.prisma.slotAssignment.findMany({ where: { eventId: id, status: { in: ['assigned', 'reserved'] } }, include: { payment: true } }),
        this.prisma.application.count({ where: { eventId: id, status: 'approved', assignments: { none: { status: { in: ['assigned', 'reserved'] } } } } }),
        this.prisma.slot.count({ where: { eventId: id, deletedAt: null } }),
      ]);
      const reserved = assignments.filter((a) => a.status === 'reserved').length;
      result.set(id, {
        todo: {
          applicationsToReview: waiting,
          oldestApplicationAt: oldest?.submittedAt.toISOString() ?? null,
          proofsToCheck: proofs.length,
          proofsTotal: proofs.reduce((sum, p) => sum + Number(p.payment.amountDue), 0),
          overduePayments: assignments.filter((a) => isOverdue(a, now)).length,
          approvedNoSlot,
          openSlots: slots - assignments.length,
        },
        fill: { reserved, assigned: assignments.length - reserved, open: slots - assignments.length },
      });
    }
    return result;
  }

  async setup(userId: string, eventId: string): Promise<EventSetup> {
    await organizerProfile(this.prisma, userId);
    const role = await this.prisma.userRole.findUniqueOrThrow({ where: { userId_role: { userId, role: 'organizer' } } });
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organizerProfile: { userId } },
      include: {
        coverFile: true,
        policySource: { select: { id: true, name: true, policyText: true } },
        categories: { include: { category: true } },
        documents: { orderBy: { sortOrder: 'asc' } },
        paymentMethods: { where: { isActive: true }, orderBy: { sortOrder: 'asc' }, include: { qrFile: true } },
        slots: { where: { deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] },
        vendorFloorPlanFile: true,
        publicFloorPlanFile: true,
      },
    });
    const image = (f: { id: string; storageKey: string } | null) => (f ? { id: f.id, url: this.files.url(f.storageKey) } : null);
    if (!event) throw new NotFoundException('Event not found');
    const start = event.startsAt ? manilaParts(event.startsAt) : null;
    const end = event.endsAt ? manilaParts(event.endsAt) : null;
    const close = event.applicationsCloseAt ? manilaParts(event.applicationsCloseAt) : null;
    return {
      id: event.id,
      slug: event.slug,
      status: event.status,
      applicationsOpen: event.applicationsOpen,
      checklist: await this.prisma.$transaction((tx) => checklist(tx, event.id)),
      organizerApproved: isApproved(role),
      details: {
        name: event.name,
        eventTypeId: event.eventTypeId,
        description: event.description,
        startDate: start?.date ?? null,
        endDate: end?.date ?? null,
        opensAt: start?.time ?? null,
        closesAt: end?.time ?? null,
        venueName: event.venueName,
        addressLine: event.addressLine,
        city: event.city,
        cover: image(event.coverFile),
        vendorContactInfo: event.vendorContactInfo,
        applicationsCloseAt: close ? `${close.date}T${close.time}` : null,
        ingressInfo: event.ingressInfo,
      },
      eventTypes: await this.eventTypes(),
      categories: await this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
      }),
      requirements: {
        categories: event.categories
          .sort((a, b) => a.category.sortOrder - b.category.sortOrder)
          .map((c) => ({ categoryId: c.categoryId, maxVendors: c.maxVendors })),
        documents: event.documents.map((d) => ({ id: d.id, name: d.name, description: d.description, categoryId: d.categoryId })),
      },
      policy: {
        text: event.policyText,
        // Only while the text is still the copied one.
        copiedFrom:
          event.policySource && event.policySource.policyText === event.policyText
            ? { id: event.policySource.id, name: event.policySource.name }
            : null,
        example: appConfig().examplePolicyText,
      },
      payments: {
        deadlineHours: event.paymentDeadlineHours,
        methods: event.paymentMethods.map((m) => ({
          id: m.id,
          channel: m.channel,
          label: m.label,
          accountName: m.accountName,
          accountNumber: m.accountNumber,
          qr: m.qrFile ? { id: m.qrFile.id, url: this.files.fileUrl(m.qrFile) } : null,
          notes: m.notes,
        })),
      },
      slots: {
        mode: event.slotMode,
        defaultPrice: event.defaultSlotPrice === null ? null : Number(event.defaultSlotPrice),
        vendorFloorPlan: image(event.vendorFloorPlanFile),
        publicFloorPlan: image(event.publicFloorPlanFile),
        list: event.slots.map((slot) => ({
          id: slot.id,
          label: slot.label,
          section: slot.section,
          sizeLabel: slot.sizeLabel,
          note: slot.note,
          price: slot.price === null ? null : Number(slot.price),
        })),
      },
    };
  }

  async updatePayments(userId: string, eventId: string, input: z.output<typeof eventPaymentsSchema>) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      const existing = await tx.eventPaymentMethod.findMany({ where: { eventId: event.id } });
      const byId = new Map(existing.map((m) => [m.id, m]));
      if (input.methods.some((m) => m.id && !byId.has(m.id))) throw new BadRequestException('This payment option is not on this event');
      for (const m of input.methods) {
        if (m.qrFileId && m.qrFileId !== byId.get(m.id ?? '')?.qrFileId) {
          await assertAttachable(tx, m.qrFileId, userId, 'payment_qr');
          await assertNotOnOtherEvent(tx, m.qrFileId, event.id);
        }
      }
      await tx.event.update({ where: { id: event.id }, data: { paymentDeadlineHours: input.deadlineHours } });
      // Removed options are turned off, not deleted (data model §5.4).
      const keep = input.methods.flatMap((m) => m.id ?? []);
      await tx.eventPaymentMethod.updateMany({ where: { eventId: event.id, id: { notIn: keep } }, data: { isActive: false } });
      for (const [sortOrder, m] of input.methods.entries()) {
        const data = {
          channel: m.channel,
          label: `${paymentChannelLabels[m.channel]}, ${m.accountName}`,
          accountName: m.accountName,
          accountNumber: m.accountNumber,
          qrFileId: m.qrFileId,
          notes: m.notes,
          sortOrder,
          isActive: true,
        };
        if (m.id) await tx.eventPaymentMethod.update({ where: { id: m.id }, data });
        else await tx.eventPaymentMethod.create({ data: { ...data, eventId: event.id } });
      }
      await assertStillReady(tx, event.id);
    });
    return this.setup(userId, eventId);
  }

  // Opens the event to vendors, and its applications with it (decided
  // 2026-11-14). Needs every required step and an approved organizer.
  async open(userId: string, eventId: string) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      const role = await tx.userRole.findUniqueOrThrow({ where: { userId_role: { userId, role: 'organizer' } } });
      if (!isApproved(role)) throw new ForbiddenException('Get approved to open this event to vendors');
      const missing = missingSteps(await checklist(tx, event.id));
      if (event.status === 'draft' && missing.length) {
        throw new ConflictException(`Finish the required steps first: ${missing.join(', ')}`);
      }
      await changeEventStatus(tx, {
        eventId: event.id,
        from: event.status,
        action: 'open_to_vendors',
        actorUserId: userId,
        data: { openedToVendorsAt: new Date(), applicationsOpen: true },
      });
    });
    return this.setup(userId, eventId);
  }

  // Deletes a draft for good (decided 2026-11-15). A draft was never shown to
  // anyone. Events vendors could see are canceled instead, never deleted, so
  // their records stay (spec §3.1, §6.7).
  async deleteDraft(userId: string, eventId: string) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      if (event.status !== 'draft') throw new ConflictException('Only drafts can be deleted. Cancel this event instead.');
      const qrs = await tx.eventPaymentMethod.findMany({ where: { eventId: event.id }, select: { qrFileId: true } });
      // Requirements, slots, and payment options go with the event (cascade).
      await tx.event.delete({ where: { id: event.id } });
      // Its pictures are marked deleted, and the cleanup job removes them.
      await retireFiles(tx, [event.coverFileId, event.vendorFloorPlanFileId, event.publicFloorPlanFileId, ...qrs.map((q) => q.qrFileId)], []);
      await writeAuditLog(tx, {
        actorUserId: userId,
        action: 'event.delete_draft',
        entityType: 'event',
        entityId: event.id,
        changes: { name: event.name, slug: event.slug },
      });
    });
  }

  // Close or reopen applications (spec §3.3) on an event vendors can see.
  async setApplications(userId: string, eventId: string, open: boolean) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      if (event.status !== 'open_to_vendors' && event.status !== 'announced') {
        throw new ConflictException('Open the event to vendors first');
      }
      if (event.applicationsOpen === open) return;
      await tx.event.update({ where: { id: event.id }, data: { applicationsOpen: open } });
      await writeAuditLog(tx, {
        actorUserId: userId,
        action: open ? 'event.applications_open' : 'event.applications_close',
        entityType: 'event',
        entityId: event.id,
        changes: { applicationsOpen: { from: !open, to: open } },
      });
    });
    return this.setup(userId, eventId);
  }

  async updateRequirements(userId: string, eventId: string, input: z.output<typeof eventRequirementsSchema>) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      const ids = input.categories.map((c) => c.categoryId);
      const active = await tx.category.count({ where: { id: { in: ids }, isActive: true } });
      if (active !== ids.length) throw new BadRequestException('Pick categories from the list');
      if (input.documents.some((d) => d.categoryId && !ids.includes(d.categoryId))) {
        throw new BadRequestException('Accept this category to ask for its document');
      }
      const existing = await tx.eventDocumentRequirement.findMany({ where: { eventId: event.id }, select: { id: true } });
      const existingIds = new Set(existing.map((d) => d.id));
      if (input.documents.some((d) => d.id && !existingIds.has(d.id))) throw new BadRequestException('This document is not on this event');

      await tx.eventCategory.deleteMany({ where: { eventId: event.id } });
      await tx.eventCategory.createMany({ data: input.categories.map((c) => ({ eventId: event.id, ...c })) });
      const keep = input.documents.flatMap((d) => d.id ?? []);
      await tx.eventDocumentRequirement.deleteMany({ where: { eventId: event.id, id: { notIn: keep } } });
      for (const [sortOrder, d] of input.documents.entries()) {
        const data = { name: d.name, description: d.description, categoryId: d.categoryId, sortOrder };
        if (d.id) await tx.eventDocumentRequirement.update({ where: { id: d.id }, data });
        else await tx.eventDocumentRequirement.create({ data: { ...data, eventId: event.id } });
      }
      await assertStillReady(tx, event.id);
    });
    return this.setup(userId, eventId);
  }

  async updatePolicy(userId: string, eventId: string, input: z.output<typeof eventPolicySchema>) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      await tx.event.update({ where: { id: event.id }, data: { policyText: input.text } });
    });
    return this.setup(userId, eventId);
  }

  async updateDetails(userId: string, eventId: string, input: z.output<typeof eventDetailsSchema>) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      if (input.eventTypeId !== event.eventTypeId) await assertEventType(tx, input.eventTypeId);
      if (input.coverFileId && input.coverFileId !== event.coverFileId) {
        await assertAttachable(tx, input.coverFileId, userId, 'event_cover');
        await assertNotOnOtherEvent(tx, input.coverFileId, event.id);
      }
      await retireFiles(tx, [event.coverFileId], [input.coverFileId]);
      const scheduled = input.startDate && input.endDate && input.opensAt && input.closesAt;
      const [closeDate, closeTime] = input.applicationsCloseAt?.split('T') ?? [];
      await tx.event.update({
        where: { id: event.id },
        data: {
          name: input.name,
          eventTypeId: input.eventTypeId,
          description: input.description,
          startsAt: scheduled ? manilaInstant(input.startDate!, input.opensAt!) : null,
          endsAt: scheduled ? manilaInstant(input.endDate!, input.closesAt!) : null,
          venueName: input.venueName,
          addressLine: input.addressLine,
          city: input.city,
          coverFileId: input.coverFileId,
          vendorContactInfo: input.vendorContactInfo,
          applicationsCloseAt: closeDate ? manilaInstant(closeDate, closeTime!) : null,
          ingressInfo: input.ingressInfo,
        },
      });
      await assertStillReady(tx, event.id);
    });
    return this.setup(userId, eventId);
  }
}

// The organizer profile of a user who may run events: the organizer role,
// not suspended, with the organizer page and a mobile number (flow 1).
// Approval is not needed for drafts (spec §10).
export async function organizerProfile(db: Db, userId: string) {
  const role = await db.userRole.findUnique({ where: { userId_role: { userId, role: 'organizer' } } });
  if (!role) throw new ForbiddenException('Add the organizer role first');
  if (role.suspendedAt) throw new ForbiddenException('Your organizer role is suspended');
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { organizerProfile: true } });
  if (!user.organizerProfile || !user.phone) {
    throw new ForbiddenException('Finish your organizer page and contact number first');
  }
  return user.organizerProfile;
}

// The organizer's own event, or Not found for anyone else, for a change. The
// row is locked for the rest of the transaction, so every change to one event
// runs one after the other: two saves can't both pass the "still ready" check
// on an open event (flow 3), or slip past a status change.
export async function ownEvent(tx: Tx, userId: string, eventId: string) {
  await organizerProfile(tx, userId);
  await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId}::uuid FOR UPDATE`;
  const event = await tx.event.findFirst({ where: { id: eventId, organizerProfile: { userId } } });
  if (!event) throw new NotFoundException('Event not found');
  return event;
}

// A picture belongs to one event. Reusing another event's file would let
// replacing or deleting it there empty it here too (data model §6.10).
export async function assertNotOnOtherEvent(tx: Tx, fileId: string, eventId: string) {
  const [event, method] = await Promise.all([
    tx.event.findFirst({
      where: { id: { not: eventId }, OR: [{ coverFileId: fileId }, { vendorFloorPlanFileId: fileId }, { publicFloorPlanFileId: fileId }] },
      select: { id: true },
    }),
    tx.eventPaymentMethod.findFirst({ where: { qrFileId: fileId, eventId: { not: eventId } }, select: { id: true } }),
  ]);
  if (event || method) throw new BadRequestException('This picture is already used on another event. Upload it again.');
}

// The "Approved by Creavent" rule (data model §7).
function isApproved(role: { approvalStatus: string | null; suspendedAt: Date | null }) {
  return role.approvalStatus === 'approved' && role.suspendedAt === null;
}

async function assertEventType(tx: Tx, eventTypeId: string) {
  const type = await tx.eventType.findFirst({ where: { id: eventTypeId, isActive: true } });
  if (!type) throw new BadRequestException('Pick an event type from the list');
}
