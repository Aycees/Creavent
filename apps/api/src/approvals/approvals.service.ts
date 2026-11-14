import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { REVIEW_TARGET_DAYS, type ApprovalDetail, type ApprovalQueueItem } from '@creavent/shared';
import { appConfig } from '../config.js';
import { FilesService } from '../files/files.service.js';
import { OutboxService } from '../notifications/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertApprovalChange, changeApprovalStatus, lockOrganizer, sameLinks, type ReviewedFields } from './approval-status.js';
import { businessDaysSince } from './business-days.js';

// Business days a request has waited, and how many past the target.
function waiting(since: Date | null) {
  const days = since ? businessDaysSince(since.toISOString()) : 0;
  return { businessDaysWaiting: days, daysOverTarget: Math.max(0, days - REVIEW_TARGET_DAYS) };
}

const queueWhere = { role: 'organizer' as const, approvalStatus: 'pending_review' as const };
const queueOrder = [{ approvalSubmittedAt: 'asc' as const }, { id: 'asc' as const }];

// Admins review organizer approval requests (spec §2.1, flow 11).
@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly files: FilesService,
  ) {}

  async queue(): Promise<ApprovalQueueItem[]> {
    const roles = await this.prisma.userRole.findMany({
      where: queueWhere,
      orderBy: queueOrder,
      include: { user: { include: { organizerProfile: true } } },
    });
    return roles.map((r) => ({
      userId: r.userId,
      displayName: r.user.organizerProfile?.displayName ?? r.user.fullName,
      city: r.user.organizerProfile?.city ?? null,
      linksCount: ((r.user.organizerProfile?.socialLinks ?? []) as string[]).length,
      submittedAt: (r.approvalSubmittedAt ?? r.updatedAt).toISOString(),
      resubmission: r.reviewedAt !== null,
      ...waiting(r.approvalSubmittedAt ?? r.updatedAt),
    }));
  }

  async detail(userId: string): Promise<ApprovalDetail> {
    const role = await this.prisma.userRole.findUnique({
      where: { userId_role: { userId, role: 'organizer' } },
      include: { user: { include: { organizerProfile: { include: { logoFile: true } }, roles: true } } },
    });
    if (!role) throw new NotFoundException('Organizer not found');
    const { user } = role;
    const profile = user.organizerProfile;
    const queue = (await this.prisma.userRole.findMany({ where: queueWhere, orderBy: queueOrder, select: { userId: true } })).map(
      (r) => r.userId,
    );
    const index = queue.indexOf(userId);
    const next = index >= 0 ? queue[index + 1] : queue[0];
    return {
      userId,
      displayName: profile?.displayName ?? user.fullName,
      slug: profile?.slug ?? null,
      city: profile?.city ?? null,
      about: profile?.about ?? null,
      logoUrl: profile?.logoFile ? this.files.url(profile.logoFile.storageKey) : null,
      socialLinks: (profile?.socialLinks ?? []) as string[],
      fullName: user.fullName,
      loginEmail: user.email,
      contactEmail: role.contactEmail,
      phone: user.phone,
      accountCreatedAt: user.createdAt.toISOString(),
      roles: user.roles.map((r) => r.role).sort(),
      status: role.approvalStatus ?? 'not_submitted',
      submittedAt: role.approvalSubmittedAt?.toISOString() ?? null,
      reviewedAt: role.reviewedAt?.toISOString() ?? null,
      rejectionReason: role.rejectionReason,
      adminNotes: role.adminNotes,
      queue: { position: index >= 0 ? index + 1 : null, total: queue.length, nextUserId: next && next !== userId ? next : null },
      ...waiting(role.approvalSubmittedAt),
    };
  }

  async decide(
    adminId: string,
    userId: string,
    seen: ReviewedFields,
    decision: { approve: true; note?: string | null } | { approve: false; reason: string; note?: string | null },
  ) {
    const config = appConfig();
    await this.prisma.$transaction(async (tx) => {
      await lockOrganizer(tx, userId);
      const role = await tx.userRole.findUnique({
        where: { userId_role: { userId, role: 'organizer' } },
        include: { user: { include: { organizerProfile: true } } },
      });
      if (!role) throw new NotFoundException('Organizer not found');
      const action = decision.approve ? 'approve' : 'reject';
      assertApprovalChange(role.approvalStatus, action);
      // The organizer can edit while waiting: decide only on what the admin saw.
      const profile = role.user.organizerProfile;
      if ((profile?.displayName ?? role.user.fullName) !== seen.displayName || !sameLinks(profile?.socialLinks, seen.socialLinks)) {
        throw new ConflictException('This request changed since you opened it. Reload to see the new details.');
      }
      await changeApprovalStatus(tx, {
        roleId: role.id,
        from: role.approvalStatus,
        action,
        actorUserId: adminId,
        reason: decision.approve ? null : decision.reason,
        data: {
          reviewedBy: { connect: { id: adminId } },
          reviewedAt: new Date(),
          rejectionReason: decision.approve ? null : decision.reason,
          reviewedLinks: (profile?.socialLinks ?? []) as string[],
          ...(decision.note !== undefined && decision.note !== null ? { adminNotes: decision.note } : {}),
        },
      });
      const name = role.user.fullName;
      await this.outbox.queue(tx, {
        userId,
        // The contact email the organizer gave for their approval (spec §2.1).
        toEmail: role.contactEmail ?? role.user.email,
        type: decision.approve ? 'organizer_approved' : 'organizer_rejected',
        relatedEntityType: 'user_role',
        relatedEntityId: role.id,
        payload: decision.approve
          ? { name, displayName: role.user.organizerProfile?.displayName ?? name, url: `${config.webUrl}/organizer`, supportEmail: config.supportEmail }
          : { name, reason: decision.reason, url: `${config.webUrl}/organizer/approval`, supportEmail: config.supportEmail },
      });
    });
    return this.detail(userId);
  }
}
