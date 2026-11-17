import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  groupSlots,
  manilaParts,
  vendorStatus,
  type ApplyBlock,
  type ApplyForm,
  type applySchema,
  type PaymentInstruction,
  type VendorApplication,
  type VendorApplicationRow,
  type VendorDashboard,
  type ApplicationSlots,
  paymentChannelLabels,
} from '@creavent/shared';
import type { z } from 'zod';
import { writeAuditLog } from '../audit/audit-log.js';
import { appConfig } from '../config.js';
import { Prisma } from '../generated/prisma/client.js';
import { assertAttachable, FilesService } from '../files/files.service.js';
import { OutboxService } from '../notifications/outbox.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { changeApplicationStatus } from './application-status.js';
import { archivePayment, changeAssignmentStatus } from './assignment-status.js';
import { approvedPerCategory, spotsLeft } from './category-counts.js';
import { PaymentsService } from './payments.service.js';
import { assertVisible } from './organizer-applications.service.js';
import { vendorProfile } from './vendor-profile.js';
import { ACTIVE, preferenceStates, slotLabel, sortedSlots, takenSlotIds } from './slot-status.js';

type Db = Tx | PrismaService;

const eventInclude = {
  categories: { include: { category: true } },
  documents: { include: { category: true }, orderBy: { sortOrder: 'asc' as const } },
  slots: { where: { deletedAt: null }, orderBy: [{ sortOrder: 'asc' as const }, { label: 'asc' as const }] },
  vendorFloorPlanFile: true,
  organizerProfile: { include: { user: { include: { roles: { where: { role: 'organizer' as const } } } } } },
} satisfies Prisma.EventInclude;

type ApplyEvent = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

// Applying and withdrawing (spec §4.2, §4.3, flow 4).
@Injectable()
export class VendorApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly outbox: OutboxService,
    private readonly payments: PaymentsService,
  ) {}

  async form(userId: string, slug: string): Promise<ApplyForm> {
    const vendor = await vendorProfile(this.prisma, userId);
    const event = await visibleEvent(this.prisma, slug);
    const approved = await approvedPerCategory(this.prisma, event.id);
    const mine = new Set(vendor.categories.map((c) => c.categoryId));
    const categories = event.categories
      .filter((c) => mine.has(c.categoryId))
      .sort((a, b) => a.category.sortOrder - b.category.sortOrder)
      .map((c) => ({ id: c.categoryId, name: c.category.name, max: c.maxVendors, left: spotsLeft(c.maxVendors, approved.get(c.categoryId) ?? 0) }));
    const standing = await this.standing(this.prisma, event.id, vendor.id);
    let blocked: ApplyBlock | null = null;
    if (!profileComplete(vendor)) blocked = 'profile_incomplete';
    else if (standing.active) blocked = 'already_applied';
    else if (standing.cannotReapply) blocked = 'cannot_reapply';
    else if (!accepting(event)) blocked = 'closed';
    else if (categories.length === 0) blocked = 'no_matching_category';

    const preferred = event.slotMode === 'vendor_preference';
    return {
      event: {
        slug: event.slug,
        name: event.name,
        startDate: event.startsAt ? manilaParts(event.startsAt).date : null,
        endDate: event.endsAt ? manilaParts(event.endsAt).date : null,
        venueName: event.venueName,
        applicationsCloseAt: event.applicationsCloseAt ? `${manilaParts(event.applicationsCloseAt).date}T${manilaParts(event.applicationsCloseAt).time}` : null,
        policy: event.policyText,
        deadlineHours: event.paymentDeadlineHours,
        preferredSlots: preferred,
        maxSlotsPerVendor: event.maxSlotsPerVendor,
        vendorFloorPlanUrl: event.vendorFloorPlanFile ? this.files.url(event.vendorFloorPlanFile.storageKey) : null,
      },
      blocked,
      activeApplicationId: standing.active?.id ?? null,
      categories,
      documents: event.documents.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        categoryId: d.categoryId,
        categoryName: d.category?.name ?? null,
        required: d.isRequired,
      })),
      slotGroups: preferred ? await this.slotGroups(this.prisma, event) : [],
    };
  }

  async apply(userId: string, slug: string, input: z.output<typeof applySchema>) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const vendor = await vendorProfile(tx, userId);
        if (!profileComplete(vendor)) throw new ForbiddenException('Add your shop name, mobile number, and a category first');
        const event = await visibleEvent(tx, slug);
        if (!accepting(event)) throw new ConflictException('Applications are closed for this event');
        const standing = await this.standing(tx, event.id, vendor.id);
        if (standing.active) throw new ConflictException('You already applied to this event');
        if (standing.cannotReapply) throw new ConflictException("You can't reapply to this event");

        // Each category is one the vendor sells and the event accepts.
        const categoryIds = [...new Set(input.categoryIds)];
        const mine = new Set(vendor.categories.map((c) => c.categoryId));
        const accepted = new Set(event.categories.map((c) => c.categoryId));
        if (!categoryIds.every((id) => mine.has(id) && accepted.has(id))) {
          throw new BadRequestException('Pick categories you sell that this event accepts');
        }

        if (input.slotsRequested > event.maxSlotsPerVendor) {
          throw new BadRequestException(`This event allows up to ${event.maxSlotsPerVendor} ${event.maxSlotsPerVendor === 1 ? 'slot' : 'slots'} per vendor`);
        }
        const documents = await this.checkDocuments(tx, userId, event, categoryIds, input.documents);
        const preferredSlotIds = await this.checkPreference(tx, event, input.preferredSlotIds, input.slotsRequested);

        const now = new Date();
        const application = await tx.application.create({
          data: {
            eventId: event.id,
            vendorProfileId: vendor.id,
            vendorNote: input.note,
            slotsRequested: input.slotsRequested,
            preferredSlots: { create: preferredSlotIds.map((slotId) => ({ slotId })) },
            // Applying means accepting the policy as it reads now (spec §3.7).
            policyTextSnapshot: event.policyText ?? '',
            policyAcceptedAt: now,
            submittedAt: now,
            categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
            documents: { create: documents },
          },
        });
        await writeAuditLog(tx, {
          actorUserId: userId,
          action: 'application.submit',
          entityType: 'application',
          entityId: application.id,
          changes: { status: { from: null, to: 'submitted' } },
        });
        await this.emailOrganizer(tx, event, 'application_submitted', application.id, vendor.shopName);
        return { id: application.id };
      });
    } catch (error) {
      // Two applies at once: the partial unique index refuses the second.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You already applied to this event');
      }
      throw error;
    }
  }

  async withdraw(userId: string, applicationId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Not while the vendor role is suspended (spec §2.1).
      await vendorProfile(tx, userId);
      const application = await tx.application.findFirst({
        where: { id: applicationId, vendorProfile: { userId } },
        include: { vendorProfile: true, event: { include: eventInclude } },
      });
      if (!application) throw new NotFoundException('Application not found');
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${application.eventId}::uuid FOR UPDATE`;
      assertVisible(application.event);
      // An unpaid slot is released with the withdrawal; a paid one isn't.
      await this.releaseActive(tx, userId, applicationId);
      await changeApplicationStatus(tx, {
        applicationId,
        from: application.status,
        action: 'withdraw',
        actorUserId: userId,
        data: { withdrawnAt: new Date() },
      });
      await this.emailOrganizer(tx, application.event, 'application_withdrawn', applicationId, application.vendorProfile.shopName);
      return { id: applicationId };
    });
  }

  // /vendor/applications: every application, newest first (spec §4.6).
  async list(userId: string): Promise<{ applications: VendorApplicationRow[] }> {
    const vendor = await vendorProfile(this.prisma, userId, { read: true });
    const applications = await this.prisma.application.findMany({
      where: { vendorProfileId: vendor.id },
      orderBy: { submittedAt: 'desc' },
      include: { event: true, assignments: { where: { status: { in: [...ACTIVE] } }, include: { slots: { include: { slot: true } }, payment: true } } },
    });
    return {
      applications: applications.map((a) => {
        const active = a.assignments[0] ?? null;
        return {
          id: a.id,
          event: eventSummary(a.event),
          status: vendorStatus(a.status, active?.status === 'assigned' || active?.status === 'reserved' ? active.status : null, a.event.status),
          slotLabel: active ? slotLabel(active.slots) : null,
          amountDue: active ? Number(active.priceLocked) : null,
          paymentStatus: active?.payment?.status ?? null,
          deadlineAt: active ? active.deadlineAt.toISOString() : null,
          decisionNote: a.decisionNote,
        };
      }),
    };
  }

  // /vendor: what needs action, applications, the next confirmed event, and
  // events open to vendors in the vendor's categories (spec §4.6).
  async dashboard(userId: string): Promise<VendorDashboard> {
    const vendor = await vendorProfile(this.prisma, userId, { read: true });
    const now = new Date();
    const [due, confirmed, { applications }] = await Promise.all([
      this.prisma.slotAssignment.findMany({
        where: { vendorProfileId: vendor.id, status: 'assigned', payment: { status: { in: ['pending', 'rejected'] } } },
        include: { slots: { include: { slot: true } }, payment: true, event: { include: { organizerProfile: true } } },
        orderBy: { deadlineAt: 'asc' },
      }),
      this.prisma.slotAssignment.findFirst({
        where: { vendorProfileId: vendor.id, status: 'reserved', event: { endsAt: { gte: now }, status: { in: ['open_to_vendors', 'announced'] } } },
        include: { slots: { include: { slot: true } }, event: { include: { vendorFloorPlanFile: true, organizerProfile: { include: { user: true } } } } },
        orderBy: { event: { startsAt: 'asc' } },
      }),
      this.list(userId),
    ]);
    const mine = vendor.categories.map((c) => c.categoryId);
    const open = await this.prisma.event.findMany({
      where: {
        status: 'open_to_vendors',
        moderationState: 'visible',
        applicationsOpen: true,
        endsAt: { gte: now },
        OR: [{ applicationsCloseAt: null }, { applicationsCloseAt: { gt: now } }],
        categories: { some: { categoryId: { in: mine } } },
      },
      orderBy: { startsAt: 'asc' },
      take: 5,
      include: { applications: { where: { vendorProfileId: vendor.id, status: { in: ['submitted', 'approved'] } }, select: { id: true } } },
    });
    return {
      needsAction: due.map((a) => {
        const options = (a.paymentInstructionsSnapshot ?? []) as PaymentInstruction[];
        const channels = [...new Set(options.map((o) => paymentChannelLabels[o.channel]))];
        return {
          applicationId: a.applicationId,
          eventName: a.event.name,
          startDate: a.event.startsAt ? manilaParts(a.event.startsAt).date : null,
          slotLabel: slotLabel(a.slots),
          amountDue: Number(a.priceLocked),
          deadlineAt: a.deadlineAt.toISOString(),
          organizerName: a.event.organizerProfile.displayName,
          paidTo: channels.length ? channels.join(' or ') : null,
          rejected: a.payment?.status === 'rejected',
        };
      }),
      applications: applications.slice(0, 6),
      nextEvent: confirmed
        ? {
            applicationId: confirmed.applicationId,
            event: eventSummary(confirmed.event),
            slotLabel: slotLabel(confirmed.slots),
            organizerName: confirmed.event.organizerProfile.displayName,
            organizerPhone: confirmed.event.organizerProfile.user.phone,
            ingressInfo: confirmed.event.ingressInfo,
            vendorFloorPlanUrl: confirmed.event.vendorFloorPlanFile ? this.files.url(confirmed.event.vendorFloorPlanFile.storageKey) : null,
          }
        : null,
      openEvents: open.map((e) => ({
        slug: e.slug,
        name: e.name,
        startDate: e.startsAt ? manilaParts(e.startsAt).date : null,
        endDate: e.endsAt ? manilaParts(e.endsAt).date : null,
        applicationsCloseAt: e.applicationsCloseAt ? `${manilaParts(e.applicationsCloseAt).date}T${manilaParts(e.applicationsCloseAt).time}` : null,
        applied: e.applications.length > 0,
      })),
    };
  }

  // /vendor/applications/[id]: only the vendor who applied (spec §4.6).
  async detail(userId: string, applicationId: string): Promise<VendorApplication> {
    const vendor = await vendorProfile(this.prisma, userId, { read: true });
    const a = await this.prisma.application.findFirst({
      where: { id: applicationId, vendorProfileId: vendor.id },
      include: {
        categories: { include: { category: true } },
        _count: { select: { documents: true } },
        preferredSlots: { include: { slot: true } },
        event: { include: { vendorFloorPlanFile: true, organizerProfile: { include: { user: { include: { roles: { where: { role: 'organizer' } } } } } } } },
        assignments: {
          orderBy: { assignedAt: 'desc' },
          include: { slots: { include: { slot: true } }, payment: { include: { proofs: { orderBy: { uploadedAt: 'desc' }, include: { paymentMethod: true, file: true } } } } },
        },
      },
    });
    if (!a) throw new NotFoundException('Application not found');
    const latest = a.assignments[0] ?? null;
    // Proofs of earlier assignments of this application (a released slot,
    // then a new one) stay readable under Payment records (spec §6.6).
    const pastProofs = a.assignments
      .slice(1)
      .flatMap((x) => x.payment?.proofs ?? [])
      .filter((p) => !p.file.deletedAt)
      .map((p) => this.payments.toProof(p));
    const active = latest && (latest.status === 'assigned' || latest.status === 'reserved') ? latest : null;
    const organizer = a.event.organizerProfile.user;
    const role = organizer.roles[0];
    const taken = a.preferredSlots.length ? await takenSlotIds(this.prisma, a.eventId) : new Set<string>();
    const instructions = (latest?.paymentInstructionsSnapshot ?? []) as PaymentInstruction[];
    return {
      id: a.id,
      status: vendorStatus(a.status, active ? (active.status as 'assigned' | 'reserved') : null, a.event.status),
      submittedAt: a.submittedAt.toISOString(),
      decidedAt: a.decidedAt?.toISOString() ?? null,
      decisionNote: a.decisionNote,
      removalNote: a.removalNote,
      canReapply: a.canReapply,
      categories: a.categories.map((c) => c.category.name),
      documentCount: a._count.documents,
      pastProofs,
      event: {
        ...eventSummary(a.event),
        addressLine: a.event.addressLine,
        city: a.event.city,
        ingressInfo: active ? a.event.ingressInfo : null,
        preferredSlots: a.event.slotMode === 'vendor_preference',
        vendorFloorPlanUrl: a.event.vendorFloorPlanFile ? this.files.url(a.event.vendorFloorPlanFile.storageKey) : null,
        hidden: a.event.moderationState === 'hidden',
      },
      organizer: {
        displayName: a.event.organizerProfile.displayName,
        fullName: organizer.fullName,
        phone: organizer.phone,
        contactEmail: role?.contactEmail ?? organizer.email,
        approved: role?.approvalStatus === 'approved' && role.suspendedAt === null,
      },
      slotsRequested: a.slotsRequested,
      preferredSlots: active ? [] : preferenceStates(a.preferredSlots, taken),
      assignment: latest
        ? {
            id: latest.id,
            status: latest.status,
            slotLabel: slotLabel(latest.slots),
            slots: sortedSlots(latest.slots).map((x) => ({ label: x.slot.label, sizeLabel: x.slot.sizeLabel, note: x.slot.note, price: Number(x.priceLocked) })),
            amountDue: Number(latest.priceLocked),
            assignedAt: latest.assignedAt.toISOString(),
            deadlineAt: latest.deadlineAt.toISOString(),
            reservedAt: latest.reservedAt?.toISOString() ?? null,
            paymentStatus: latest.payment?.status ?? 'pending',
            instructions: instructions.map((i) => ({ ...i, qrUrl: i.qrFileId ? `/api/files/${i.qrFileId}` : null })),
            proofs: (latest.payment?.proofs ?? []).filter((p) => !p.file.deletedAt).map((p) => this.payments.toProof(p)),
            paymentNote: latest.payment?.method !== 'proof_upload' ? (latest.payment?.decisionNote ?? null) : null,
            archived: latest.payment?.archivedAt != null,
          }
        : null,
    };
  }

  // Release an assigned slot before payment is approved. Organizers can't
  // turn this off (spec §6.6). The vendor stays approved, without a slot.
  async release(userId: string, applicationId: string) {
    await this.prisma.$transaction(async (tx) => {
      const { application, vendor } = await this.ownApplication(tx, userId, applicationId);
      const released = await this.releaseActive(tx, userId, applicationId);
      if (!released) throw new ConflictException('You have no slot to release here');
      await this.emailOrganizer(tx, released.event, 'slot_released', application.id, vendor.shopName, { slotLabel: slotLabel(released.slots) });
    });
  }

  // Change or clear the preferred slots while no slot is assigned (decided
  // 2026-11-15). A preference still holds nothing (spec §4.3).
  async setPreference(userId: string, applicationId: string, slotIds: string[]) {
    await this.prisma.$transaction(async (tx) => {
      const { application } = await this.ownApplication(tx, userId, applicationId);
      if (!['submitted', 'approved'].includes(application.status) || (await this.activeAssignment(tx, applicationId))) {
        throw new ConflictException('You can change your preferred slot only before a slot is assigned');
      }
      const event = await tx.event.findUniqueOrThrow({ where: { id: application.eventId }, include: eventInclude });
      if (event.slotMode !== 'vendor_preference') throw new ConflictException('The organizer assigns slots at this event');
      const preferredSlotIds = await this.checkPreference(tx, event, slotIds, application.slotsRequested);
      await this.replacePreferences(tx, userId, applicationId, preferredSlotIds);
    });
  }

  // Swap unpaid slots for new preferred ones: all of them are released
  // together and the organizer assigns the new picks (decisions P5, P6).
  async changeSlot(userId: string, applicationId: string, slotIds: string[]) {
    await this.prisma.$transaction(async (tx) => {
      const { application, vendor } = await this.ownApplication(tx, userId, applicationId);
      const event = await tx.event.findUniqueOrThrow({ where: { id: application.eventId }, include: eventInclude });
      if (event.slotMode !== 'vendor_preference') throw new ConflictException('The organizer assigns slots at this event');
      const active = await tx.slotAssignment.findFirst({ where: { applicationId, status: { in: [...ACTIVE] } }, include: { slots: true } });
      if (!active) throw new ConflictException('You have no slot to change here');
      const current = new Set(active.slots.map((x) => x.slotId));
      if (slotIds.length === current.size && slotIds.every((id) => current.has(id))) throw new BadRequestException('Pick a different slot');
      if (active.status === 'reserved') throw new ConflictException('Your payment is approved, so contact the organizer to change slots');
      const released = (await this.releaseActive(tx, userId, applicationId))!;
      // After the release, so the vendor's own slots count as open again.
      const preferredSlotIds = await this.checkPreference(tx, event, slotIds, application.slotsRequested);
      await this.replacePreferences(tx, userId, applicationId, preferredSlotIds);
      const newLabels = event.slots.filter((x) => preferredSlotIds.includes(x.id)).map((x) => x.label).join(', ');
      await this.emailOrganizer(tx, event, 'slot_released', applicationId, vendor.shopName, { slotLabel: slotLabel(released.slots), newPreference: newLabels });
    });
  }

  private async replacePreferences(tx: Tx, userId: string, applicationId: string, slotIds: string[]) {
    const before = await tx.applicationPreferredSlot.findMany({ where: { applicationId } });
    await tx.applicationPreferredSlot.deleteMany({ where: { applicationId } });
    await tx.applicationPreferredSlot.createMany({ data: slotIds.map((slotId) => ({ applicationId, slotId })) });
    await writeAuditLog(tx, {
      actorUserId: userId,
      action: 'application.preference_change',
      entityType: 'application',
      entityId: applicationId,
      changes: { preferredSlotIds: { from: before.map((p) => p.slotId), to: slotIds } },
    });
  }

  // Open and taken slots, for picking a new preference.
  async slots(userId: string, applicationId: string): Promise<ApplicationSlots> {
    const { application } = await this.ownApplication(this.prisma, userId, applicationId, false);
    const event = await this.prisma.event.findUniqueOrThrow({ where: { id: application.eventId }, include: eventInclude });
    const active = await this.prisma.slotAssignment.findFirst({
      where: { applicationId, status: { in: [...ACTIVE] } },
      include: { slots: { include: { slot: true } } },
    });
    const preferred = await this.prisma.applicationPreferredSlot.findMany({ where: { applicationId } });
    return {
      currentSlotLabel: active ? slotLabel(active.slots) : null,
      slotsRequested: application.slotsRequested,
      preferredSlotIds: preferred.map((p) => p.slotId),
      vendorFloorPlanUrl: event.vendorFloorPlanFile ? this.files.url(event.vendorFloorPlanFile.storageKey) : null,
      slotGroups: await this.slotGroups(this.prisma, event),
    };
  }

  // The vendor's own application, or Not found. In a transaction, its event
  // row is locked so the change runs after any organizer decision on it.
  private async ownApplication(db: Db, userId: string, applicationId: string, lock = true) {
    const vendor = await vendorProfile(db, userId);
    const application = await db.application.findFirst({ where: { id: applicationId, vendorProfileId: vendor.id }, include: { event: { select: { moderationState: true } } } });
    if (!application) throw new NotFoundException('Application not found');
    if (lock) await db.$queryRaw`SELECT id FROM events WHERE id = ${application.eventId}::uuid FOR UPDATE`;
    // Nothing changes while Creavent has the event hidden (decided 2026-11-17).
    assertVisible(application.event);
    return { application, vendor };
  }

  private activeAssignment(db: Db, applicationId: string) {
    return db.slotAssignment.findFirst({ where: { applicationId, status: { in: [...ACTIVE] } } });
  }

  // Release an active, unpaid slot: ends the assignment and archives its
  // payment. Refuses a paid (reserved) slot. Returns null with no slot.
  private async releaseActive(tx: Tx, userId: string, applicationId: string) {
    const assignment = await tx.slotAssignment.findFirst({
      where: { applicationId, status: { in: [...ACTIVE] } },
      include: { slots: { include: { slot: true } }, event: { include: eventInclude } },
    });
    if (!assignment) return null;
    if (assignment.status === 'reserved') throw new ConflictException('Your payment is approved, so contact the organizer to cancel');
    const now = new Date();
    await changeAssignmentStatus(tx, {
      assignmentId: assignment.id,
      from: assignment.status,
      action: 'release',
      actorUserId: userId,
      data: { endedAt: now, endedById: userId, endedReason: 'Released by the vendor' },
    });
    await archivePayment(tx, assignment.id, now);
    return assignment;
  }

  // The event's slots by section, each open or taken (spec §4.3).
  private async slotGroups(db: Db, event: ApplyEvent) {
    const taken = await takenSlotIds(db, event.id);
    const fallback = event.defaultSlotPrice === null ? null : Number(event.defaultSlotPrice);
    return groupSlots(event.slots).map((g) => ({
      name: g.name,
      slots: g.slots.map((x) => ({
        id: x.id,
        label: x.label,
        sizeLabel: x.sizeLabel,
        note: x.note,
        price: x.price === null ? fallback : Number(x.price),
        taken: taken.has(x.id),
      })),
    }));
  }

  // The vendor's active application here, and whether a removal blocks them.
  private async standing(db: Db, eventId: string, vendorProfileId: string) {
    const active = await db.application.findFirst({ where: { eventId, vendorProfileId, status: { in: ['submitted', 'approved'] } } });
    const latest = await db.application.findFirst({ where: { eventId, vendorProfileId }, orderBy: { submittedAt: 'desc' } });
    return { active, cannotReapply: latest?.status === 'removed' && latest.canReapply === false };
  }

  // Every required document for the picked categories, each a ready
  // document file of this vendor's not used by another application.
  private async checkDocuments(
    tx: Tx,
    userId: string,
    event: ApplyEvent,
    categoryIds: string[],
    sent: z.output<typeof applySchema>['documents'],
  ) {
    const applies = (d: ApplyEvent['documents'][number]) => d.categoryId === null || categoryIds.includes(d.categoryId);
    const asked = new Map(event.documents.filter(applies).map((d) => [d.id, d]));
    const fileIds = new Set<string>();
    for (const doc of sent) {
      if (!asked.has(doc.requirementId)) throw new BadRequestException("This document isn't asked for here");
      for (const fileId of doc.fileIds) {
        if (fileIds.has(fileId)) throw new BadRequestException('This file cannot be used here');
        fileIds.add(fileId);
      }
    }
    const given = new Set(sent.filter((d) => d.fileIds.length > 0).map((d) => d.requirementId));
    const missing = [...asked.values()].find((d) => d.isRequired && !given.has(d.id));
    if (missing) throw new BadRequestException(`Upload your ${missing.name}`);
    for (const fileId of fileIds) {
      await assertAttachable(tx, fileId, userId, 'application_document');
      if (await tx.applicationDocument.findFirst({ where: { fileId } })) throw new BadRequestException('This file cannot be used here');
    }
    return sent.flatMap((d) => d.fileIds.map((fileId) => ({ requirementId: d.requirementId, fileId })));
  }

  // Preferences are kept only when the event lets vendors choose, at most as
  // many as the slots asked for, each an open slot of this event (data model
  // §6.10).
  private async checkPreference(tx: Tx, event: ApplyEvent, slotIds: string[], slotsRequested: number) {
    if (event.slotMode !== 'vendor_preference' || slotIds.length === 0) return [];
    if (slotIds.length > slotsRequested) throw new BadRequestException(`Pick at most ${slotsRequested} ${slotsRequested === 1 ? 'slot' : 'slots'}`);
    const taken = await takenSlotIds(tx, event.id);
    for (const id of slotIds) {
      const slot = event.slots.find((x) => x.id === id);
      if (!slot || taken.has(slot.id)) throw new BadRequestException('Pick an open slot, or No preference');
    }
    return slotIds;
  }

  private async emailOrganizer(
    tx: Tx,
    event: ApplyEvent,
    type: 'application_submitted' | 'application_withdrawn' | 'slot_released',
    applicationId: string,
    shopName: string,
    extra: Record<string, string> = {},
  ) {
    const organizer = event.organizerProfile.user;
    const config = appConfig();
    await this.outbox.queue(tx, {
      userId: organizer.id,
      toEmail: organizer.roles[0]?.contactEmail ?? organizer.email,
      type,
      payload: {
        name: organizer.fullName,
        shopName,
        eventName: event.name,
        url: `${config.webUrl}/organizer/events/${event.id}/${type === 'slot_released' ? 'vendors' : 'applications'}`,
        supportEmail: config.supportEmail,
        ...extra,
      },
      relatedEntityType: 'application',
      relatedEntityId: applicationId,
    });
  }
}

function eventSummary(e: { slug: string; name: string; startsAt: Date | null; endsAt: Date | null; venueName: string | null }) {
  const start = e.startsAt ? manilaParts(e.startsAt) : null;
  const end = e.endsAt ? manilaParts(e.endsAt) : null;
  return {
    slug: e.slug,
    name: e.name,
    startDate: start?.date ?? null,
    endDate: end?.date ?? null,
    opensAt: start?.time ?? null,
    closesAt: end?.time ?? null,
    venueName: e.venueName,
  };
}

// A vendor applies only with a shop name, mobile number, and a category (spec §1.1).
function profileComplete(p: Awaited<ReturnType<typeof vendorProfile>>) {
  return p.shopName.trim() !== '' && Boolean(p.user.phone) && p.categories.length > 0;
}

// An event vendors can see: open to vendors or announced, and not hidden.
async function visibleEvent(db: Db, slug: string) {
  const event = await db.event.findUnique({ where: { slug }, include: eventInclude });
  if (!event || !['open_to_vendors', 'announced'].includes(event.status) || event.moderationState === 'hidden') {
    throw new NotFoundException('Event not found');
  }
  return event;
}

// "Accepting applications" (data model §7).
export function accepting(e: { status: string; applicationsOpen: boolean; moderationState: string; applicationsCloseAt: Date | null }) {
  return (
    (e.status === 'open_to_vendors' || e.status === 'announced') &&
    e.applicationsOpen &&
    e.moderationState === 'visible' &&
    (e.applicationsCloseAt === null || e.applicationsCloseAt > new Date())
  );
}
