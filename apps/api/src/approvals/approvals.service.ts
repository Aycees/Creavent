import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApprovalDetail, ApprovalQueueItem } from '@creavent/shared';
import { writeAuditLog } from '../audit/audit-log.js';
import { appConfig } from '../config.js';
import { FilesService } from '../files/files.service.js';
import { OutboxService } from '../notifications/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertApprovalChange } from './approval-status.js';

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
    };
  }

  async decide(adminId: string, userId: string, decision: { approve: true; note?: string | null } | { approve: false; reason: string; note?: string | null }) {
    const config = appConfig();
    await this.prisma.$transaction(async (tx) => {
      const role = await tx.userRole.findUnique({
        where: { userId_role: { userId, role: 'organizer' } },
        include: { user: { include: { organizerProfile: true } } },
      });
      if (!role) throw new NotFoundException('Organizer not found');
      const to = decision.approve ? 'approved' : 'rejected';
      assertApprovalChange(role.approvalStatus, to);
      await tx.userRole.update({
        where: { id: role.id },
        data: {
          approvalStatus: to,
          reviewedById: adminId,
          reviewedAt: new Date(),
          rejectionReason: decision.approve ? null : decision.reason,
          reviewedLinks: (role.user.organizerProfile?.socialLinks ?? []) as string[],
          ...(decision.note !== undefined && decision.note !== null ? { adminNotes: decision.note } : {}),
        },
      });
      await writeAuditLog(tx, {
        actorUserId: adminId,
        action: `organizer_approval.${decision.approve ? 'approve' : 'reject'}`,
        entityType: 'user_role',
        entityId: role.id,
        changes: { approvalStatus: { from: role.approvalStatus, to } },
        reason: decision.approve ? null : decision.reason,
      });
      const name = role.user.fullName;
      await this.outbox.queue(tx, {
        userId,
        toEmail: role.user.email,
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
