import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { EventApplications } from '@creavent/shared';
import { appConfig } from '../config.js';
import { organizerProfile, ownEvent } from '../events/organizer-events.service.js';
import { FilesService } from '../files/files.service.js';
import { OutboxService } from '../notifications/outbox.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { writeAuditLog } from '../audit/audit-log.js';
import { changeApplicationStatus } from './application-status.js';
import { approvedPerCategory } from './category-counts.js';
import { preferenceStates, takenSlotIds } from './slot-status.js';

// The organizer reviews applications (spec §3.3, flow 5).
@Injectable()
export class OrganizerApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly outbox: OutboxService,
  ) {}

  async list(userId: string, eventId: string): Promise<EventApplications> {
    await organizerProfile(this.prisma, userId, { read: true });
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organizerProfile: { userId } },
      include: { categories: { include: { category: true } } },
    });
    if (!event) throw new NotFoundException('Event not found');
    const [approved, taken, applications] = await Promise.all([
      approvedPerCategory(this.prisma, eventId),
      takenSlotIds(this.prisma, eventId),
      this.prisma.application.findMany({
        where: { eventId },
        orderBy: { submittedAt: 'asc' },
        include: {
          vendorProfile: { include: { user: { include: { avatarFile: true } } } },
          categories: { include: { category: true } },
          documents: { include: { file: true, requirement: true } },
          preferredSlots: { include: { slot: true } },
        },
      }),
    ]);
    return {
      event: {
        id: event.id,
        slug: event.slug,
        name: event.name,
        status: event.status,
        applicationsOpen: event.applicationsOpen,
        preferredSlots: event.slotMode === 'vendor_preference',
      },
      counters: event.categories
        .sort((a, b) => a.category.sortOrder - b.category.sortOrder)
        .map((c) => ({ categoryId: c.categoryId, name: c.category.name, approved: approved.get(c.categoryId) ?? 0, max: c.maxVendors })),
      applications: applications.map((a) => ({
        id: a.id,
        status: a.status,
        submittedAt: a.submittedAt.toISOString(),
        decidedAt: a.decidedAt?.toISOString() ?? null,
        note: a.vendorNote,
        decisionNote: a.decisionNote,
        vendor: {
          shopName: a.vendorProfile.shopName,
          slug: a.vendorProfile.slug,
          fullName: a.vendorProfile.user.fullName,
          phone: a.vendorProfile.user.phone,
          avatarUrl: a.vendorProfile.user.avatarFile ? this.files.url(a.vendorProfile.user.avatarFile.storageKey) : null,
        },
        categories: a.categories.map((c) => ({ id: c.categoryId, name: c.category.name })),
        documents: a.documents
          .filter((d) => !d.file.deletedAt)
          .map((d) => ({
            id: d.id,
            name: d.requirement?.name ?? 'Other document',
            url: this.files.fileUrl(d.file),
            isPdf: d.file.mimeType === 'application/pdf',
          })),
        canReapply: a.canReapply,
        slotsRequested: a.slotsRequested,
        preferredSlots: preferenceStates(a.preferredSlots, taken),
      })),
    };
  }

  async reapply(userId: string, eventId: string, applicationId: string, canReapply: boolean) {
    await this.prisma.$transaction((tx) => setReapply(tx, userId, eventId, applicationId, canReapply));
    return this.list(userId, eventId);
  }

  async decide(userId: string, eventId: string, applicationId: string, action: 'approve' | 'decline', note: string | null) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      assertVisible(event);
      const application = await tx.application.findFirst({
        where: { id: applicationId, eventId },
        include: { vendorProfile: { include: { user: true } } },
      });
      if (!application) throw new NotFoundException('Application not found');
      await changeApplicationStatus(tx, {
        applicationId,
        from: application.status,
        action,
        actorUserId: userId,
        data: { decidedById: userId, decidedAt: new Date(), decisionNote: note },
      });
      const vendor = application.vendorProfile.user;
      const config = appConfig();
      await this.outbox.queue(tx, {
        userId: vendor.id,
        toEmail: vendor.email,
        type: action === 'approve' ? 'application_approved' : 'application_declined',
        payload: {
          name: vendor.fullName,
          eventName: event.name,
          note,
          url: `${config.webUrl}/vendor/applications/${applicationId}`,
          supportEmail: config.supportEmail,
        },
        relatedEntityType: 'application',
        relatedEntityId: applicationId,
      });
    });
    return this.list(userId, eventId);
  }
}

// Allow or block a removed vendor from applying again, after the removal
// (spec §3.3). The removed application stays as history.
export async function setReapply(tx: Tx, userId: string, eventId: string, applicationId: string, canReapply: boolean) {
  await ownEvent(tx, userId, eventId);
  const application = await tx.application.findFirst({ where: { id: applicationId, eventId } });
  if (!application) throw new NotFoundException('Application not found');
  if (application.status !== 'removed') throw new ConflictException('Only removed vendors can be allowed or blocked from applying again');
  await tx.application.update({ where: { id: applicationId }, data: { canReapply } });
  await writeAuditLog(tx, {
    actorUserId: userId,
    action: canReapply ? 'application.reapply_allowed' : 'application.reapply_blocked',
    entityType: 'application',
    entityId: applicationId,
    changes: { canReapply: { from: application.canReapply, to: canReapply } },
  });
}

// A hidden event takes no new applications, assignments, proofs, or
// approvals (data model §6.8).
export function assertVisible(event: { moderationState: string }) {
  if (event.moderationState === 'hidden') throw new ConflictException('This event is hidden by Creavent');
}

