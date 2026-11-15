import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { groupSlots, manilaParts, type ApplyBlock, type ApplyForm, type applySchema } from '@creavent/shared';
import type { z } from 'zod';
import { writeAuditLog } from '../audit/audit-log.js';
import { appConfig } from '../config.js';
import { Prisma } from '../generated/prisma/client.js';
import { assertAttachable, FilesService } from '../files/files.service.js';
import { OutboxService } from '../notifications/outbox.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { changeApplicationStatus } from './application-status.js';
import { approvedPerCategory, spotsLeft } from './category-counts.js';
import { takenSlotIds } from './slot-status.js';

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
    type: 'application_submitted' | 'application_withdrawn',
    applicationId: string,
    shopName: string,
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
        url: `${config.webUrl}/organizer/events/${event.id}/applications`,
        supportEmail: config.supportEmail,
      },
      relatedEntityType: 'application',
      relatedEntityId: applicationId,
    });
  }
}

// The vendor role, not suspended, with a shop profile.
export async function vendorProfile(db: Db, userId: string) {
  const role = await db.userRole.findUnique({ where: { userId_role: { userId, role: 'vendor' } } });
  if (!role) throw new ForbiddenException('Add the vendor role first');
  if (role.suspendedAt) throw new ForbiddenException('Your vendor role is suspended');
  const profile = await db.vendorProfile.findUnique({ where: { userId }, include: { categories: true, user: true } });
  if (!profile) throw new ForbiddenException('Finish your shop profile first');
  return profile;
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
