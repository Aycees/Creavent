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
import { vendorProfile } from './vendor-profile.js';
import { ACTIVE, takenSlotIds } from './slot-status.js';

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
    const taken = preferred ? await takenSlotIds(this.prisma, event.id) : new Set<string>();
    const fallback = event.defaultSlotPrice === null ? null : Number(event.defaultSlotPrice);
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
      slotGroups: preferred
        ? groupSlots(event.slots).map((g) => ({
            name: g.name,
            slots: g.slots.map((s) => ({
              id: s.id,
              label: s.label,
              sizeLabel: s.sizeLabel,
              note: s.note,
              price: s.price === null ? fallback : Number(s.price),
              taken: taken.has(s.id),
            })),
          }))
        : [],
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

        const documents = await this.checkDocuments(tx, userId, event, categoryIds, input.documents);
        const preferredSlotId = await this.checkPreference(tx, event, input.preferredSlotId);

        const now = new Date();
        const application = await tx.application.create({
          data: {
            eventId: event.id,
            vendorProfileId: vendor.id,
            vendorNote: input.note,
            preferredSlotId,
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
      const application = await tx.application.findFirst({
        where: { id: applicationId, vendorProfile: { userId } },
        include: { vendorProfile: true, event: { include: eventInclude } },
      });
      if (!application) throw new NotFoundException('Application not found');
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
    const vendor = await vendorProfile(this.prisma, userId);
    const applications = await this.prisma.application.findMany({
      where: { vendorProfileId: vendor.id },
      orderBy: { submittedAt: 'desc' },
      include: { event: true, assignments: { where: { status: { in: [...ACTIVE] } }, include: { slot: true, payment: true } } },
    });
    return {
      applications: applications.map((a) => {
        const active = a.assignments[0] ?? null;
        return {
          id: a.id,
          event: eventSummary(a.event),
          status: vendorStatus(a.status, active?.status === 'assigned' || active?.status === 'reserved' ? active.status : null),
          slotLabel: active?.slot.label ?? null,
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
    const vendor = await vendorProfile(this.prisma, userId);
    const now = new Date();
    const [due, confirmed, { applications }] = await Promise.all([
      this.prisma.slotAssignment.findMany({
        where: { vendorProfileId: vendor.id, status: 'assigned', payment: { status: { in: ['pending', 'rejected'] } } },
        include: { slot: true, payment: true, event: { include: { organizerProfile: true } } },
        orderBy: { deadlineAt: 'asc' },
      }),
      this.prisma.slotAssignment.findFirst({
        where: { vendorProfileId: vendor.id, status: 'reserved', event: { endsAt: { gte: now }, status: { in: ['open_to_vendors', 'announced'] } } },
        include: { slot: true, event: { include: { vendorFloorPlanFile: true, organizerProfile: { include: { user: true } } } } },
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
          slotLabel: a.slot.label,
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
            slotLabel: confirmed.slot.label,
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
    const vendor = await vendorProfile(this.prisma, userId);
    const a = await this.prisma.application.findFirst({
      where: { id: applicationId, vendorProfileId: vendor.id },
      include: {
        categories: { include: { category: true } },
        _count: { select: { documents: true } },
        preferredSlot: true,
        event: { include: { vendorFloorPlanFile: true, organizerProfile: { include: { user: { include: { roles: { where: { role: 'organizer' } } } } } } } },
        assignments: {
          orderBy: { assignedAt: 'desc' },
          take: 1,
          include: { slot: true, payment: { include: { proofs: { orderBy: { uploadedAt: 'desc' }, include: { paymentMethod: true, file: true } } } } },
        },
      },
    });
    if (!a) throw new NotFoundException('Application not found');
    const latest = a.assignments[0] ?? null;
    const active = latest && (latest.status === 'assigned' || latest.status === 'reserved') ? latest : null;
    const organizer = a.event.organizerProfile.user;
    const role = organizer.roles[0];
    const taken = a.preferredSlot ? await takenSlotIds(this.prisma, a.eventId) : new Set<string>();
    const instructions = (latest?.paymentInstructionsSnapshot ?? []) as PaymentInstruction[];
    return {
      id: a.id,
      status: vendorStatus(a.status, active ? (active.status as 'assigned' | 'reserved') : null),
      submittedAt: a.submittedAt.toISOString(),
      decidedAt: a.decidedAt?.toISOString() ?? null,
      decisionNote: a.decisionNote,
      removalNote: a.removalNote,
      categories: a.categories.map((c) => c.category.name),
      documentCount: a._count.documents,
      event: {
        ...eventSummary(a.event),
        addressLine: a.event.addressLine,
        city: a.event.city,
        ingressInfo: active ? a.event.ingressInfo : null,
        vendorFloorPlanUrl: a.event.vendorFloorPlanFile ? this.files.url(a.event.vendorFloorPlanFile.storageKey) : null,
      },
      organizer: {
        displayName: a.event.organizerProfile.displayName,
        fullName: organizer.fullName,
        phone: organizer.phone,
        contactEmail: role?.contactEmail ?? organizer.email,
        approved: role?.approvalStatus === 'approved' && role.suspendedAt === null,
      },
      preferredSlot:
        a.preferredSlot && !latest
          ? { label: a.preferredSlot.label, state: a.preferredSlot.deletedAt ? 'removed' : taken.has(a.preferredSlot.id) ? 'taken' : 'open' }
          : null,
      assignment: latest
        ? {
            id: latest.id,
            status: latest.status,
            slotLabel: latest.slot.label,
            sizeLabel: latest.slot.sizeLabel,
            note: latest.slot.note,
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
      const vendor = await vendorProfile(tx, userId);
      const application = await tx.application.findFirst({ where: { id: applicationId, vendorProfileId: vendor.id } });
      if (!application) throw new NotFoundException('Application not found');
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${application.eventId}::uuid FOR UPDATE`;
      const assignment = await tx.slotAssignment.findFirst({
        where: { applicationId, status: { in: [...ACTIVE] } },
        include: { slot: true, event: { include: eventInclude } },
      });
      if (!assignment) throw new ConflictException('You have no slot to release here');
      const now = new Date();
      await changeAssignmentStatus(tx, {
        assignmentId: assignment.id,
        from: assignment.status,
        action: 'release',
        actorUserId: userId,
        data: { endedAt: now, endedById: userId, endedReason: 'Released by the vendor' },
      });
      await archivePayment(tx, assignment.id, now);
      await this.emailOrganizer(tx, assignment.event, 'slot_released', applicationId, vendor.shopName, { slotLabel: assignment.slot.label });
    });
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

  // A preference is kept only when the event lets vendors choose, and must be
  // an open slot of this event (data model §6.10).
  private async checkPreference(tx: Tx, event: ApplyEvent, slotId: string | null) {
    if (event.slotMode !== 'vendor_preference' || slotId === null) return null;
    const slot = event.slots.find((s) => s.id === slotId);
    if (!slot || (await takenSlotIds(tx, event.id)).has(slot.id)) {
      throw new BadRequestException('Pick an open slot, or No preference');
    }
    return slot.id;
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
