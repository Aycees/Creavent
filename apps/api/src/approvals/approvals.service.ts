import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { REVIEW_TARGET_DAYS, type ApprovalDetail, type ApprovalKind, type ApprovalQueueItem } from '@creavent/shared';
import { appConfig } from '../config.js';
import { FilesService } from '../files/files.service.js';
import { OutboxService } from '../notifications/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertApprovalChange, changeApprovalStatus, lockOrganizer, lockVendor, sameLinks, type ReviewedFields } from './approval-status.js';
import { businessDaysSince } from './business-days.js';
import { eventsSoldAt } from '../public/public-pages.service.js';
import { PublicRefreshService } from '../public/public-refresh.service.js';
import { tags } from '../public/tags.js';

// Business days a request has waited, and how many past the target.
function waiting(since: Date | null) {
  const days = since ? businessDaysSince(since.toISOString()) : 0;
  return { businessDaysWaiting: days, daysOverTarget: Math.max(0, days - REVIEW_TARGET_DAYS) };
}

// Organizer requests on the organizer row, host requests on the vendor row
// (spec §4.7). One queue, oldest first.
const queueWhere = { role: { in: ['organizer' as const, 'vendor' as const] }, approvalStatus: 'pending_review' as const };
const queueOrder = [{ approvalSubmittedAt: 'asc' as const }, { id: 'asc' as const }];
const roleOf = (kind: ApprovalKind) => (kind === 'host' ? ('vendor' as const) : ('organizer' as const));
const kindOf = (role: string): ApprovalKind => (role === 'vendor' ? 'host' : 'organizer');

// Admins review organizer approval and pop-up host requests (spec §2.1,
// §4.7, flow 11).
@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly files: FilesService,
    private readonly refresh: PublicRefreshService,
  ) {}

  async queue(): Promise<ApprovalQueueItem[]> {
    const roles = await this.prisma.userRole.findMany({
      where: queueWhere,
      orderBy: queueOrder,
      include: { user: { include: { organizerProfile: true, vendorProfile: true } } },
    });
    return roles.map((r) => {
      const host = r.role === 'vendor';
      const links = (host ? r.user.vendorProfile?.socialLinks : r.user.organizerProfile?.socialLinks) ?? [];
      return {
        userId: r.userId,
        kind: kindOf(r.role),
        displayName: (host ? r.user.vendorProfile?.shopName : r.user.organizerProfile?.displayName) ?? r.user.fullName,
        city: (host ? r.user.vendorProfile?.city : r.user.organizerProfile?.city) ?? null,
        linksCount: (links as string[]).length,
        submittedAt: (r.approvalSubmittedAt ?? r.updatedAt).toISOString(),
        resubmission: r.reviewedAt !== null,
        ...waiting(r.approvalSubmittedAt ?? r.updatedAt),
      };
    });
  }

  async detail(userId: string, kind: ApprovalKind = 'organizer'): Promise<ApprovalDetail> {
    const role = await this.prisma.userRole.findUnique({
      where: { userId_role: { userId, role: roleOf(kind) } },
      include: {
        user: {
          include: {
            avatarFile: true,
            organizerProfile: { include: { logoFile: true } },
            vendorProfile: {
              include: {
                categories: { include: { category: true } },
                photos: { include: { file: true }, orderBy: { sortOrder: 'asc' }, take: 8 },
                popups: { orderBy: { createdAt: 'desc' }, take: 5 },
              },
            },
            roles: true,
          },
        },
      },
    });
    if (!role) throw new NotFoundException(kind === 'host' ? 'Vendor not found' : 'Organizer not found');
    const { user } = role;
    const queue = await this.prisma.userRole.findMany({ where: queueWhere, orderBy: queueOrder, select: { userId: true, role: true } });
    const index = queue.findIndex((r) => r.userId === userId && r.role === role.role);
    const next = index >= 0 ? queue[index + 1] : queue[0];
    const isNext = next && !(next.userId === userId && next.role === role.role);
    const reviewed = (role.reviewedLinks ?? []) as string[];
    const common = {
      userId,
      kind,
      fullName: user.fullName,
      loginEmail: user.email,
      phone: user.phone,
      accountCreatedAt: user.createdAt.toISOString(),
      roles: user.roles.map((r) => r.role).sort(),
      status: role.approvalStatus ?? 'not_submitted',
      submittedAt: role.approvalSubmittedAt?.toISOString() ?? null,
      reviewedAt: role.reviewedAt?.toISOString() ?? null,
      rejectionReason: role.rejectionReason,
      adminNotes: role.adminNotes,
      queue: { position: index >= 0 ? index + 1 : null, total: queue.length, nextUserId: isNext ? next.userId : null, nextKind: isNext ? kindOf(next.role) : null },
      ...waiting(role.approvalSubmittedAt),
    };
    if (kind === 'host') {
      const v = user.vendorProfile;
      const links = (v?.socialLinks ?? []) as string[];
      return {
        ...common,
        displayName: v?.shopName ?? user.fullName,
        slug: v?.slug ?? null,
        city: v?.city ?? null,
        about: v?.description ?? null,
        logoUrl: user.avatarFile ? this.files.url(user.avatarFile.storageKey) : null,
        socialLinks: links,
        newLinks: role.reviewedAt ? links.filter((l) => !reviewed.includes(l)) : [],
        contactEmail: null,
        host: {
          categories: (v?.categories ?? []).sort((a, b) => a.category.sortOrder - b.category.sortOrder).map((c) => c.category.name),
          products: v?.products ?? null,
          photos: (v?.photos ?? []).filter((p) => !p.file.deletedAt).map((p) => this.files.url(p.file.storageKey)),
          eventsSoldAt: v ? await eventsSoldAt(this.prisma, v.id) : 0,
          popups: (v?.popups ?? []).map((e) => ({ name: e.name, status: e.status, startsAt: e.startsAt?.toISOString() ?? null })),
        },
      };
    }
    const profile = user.organizerProfile;
    const links = (profile?.socialLinks ?? []) as string[];
    return {
      ...common,
      displayName: profile?.displayName ?? user.fullName,
      slug: profile?.slug ?? null,
      city: profile?.city ?? null,
      about: profile?.about ?? null,
      logoUrl: profile?.logoFile ? this.files.url(profile.logoFile.storageKey) : null,
      socialLinks: links,
      newLinks: role.reviewedAt ? links.filter((l) => !reviewed.includes(l)) : [],
      contactEmail: role.contactEmail,
      host: null,
    };
  }

  async decide(
    adminId: string,
    userId: string,
    seen: ReviewedFields,
    decision: { approve: true; note?: string | null } | { approve: false; reason: string; note?: string | null },
    kind: ApprovalKind = 'organizer',
  ) {
    const config = appConfig();
    const refresh = await this.prisma.$transaction(async (tx) => {
      if (kind === 'host') await lockVendor(tx, userId);
      else await lockOrganizer(tx, userId);
      const role = await tx.userRole.findUnique({
        where: { userId_role: { userId, role: roleOf(kind) } },
        include: { user: { include: { organizerProfile: true, vendorProfile: true } } },
      });
      if (!role) throw new NotFoundException(kind === 'host' ? 'Vendor not found' : 'Organizer not found');
      const action = decision.approve ? 'approve' : 'reject';
      assertApprovalChange(role.approvalStatus, action, kind);
      // The organizer or vendor can edit while waiting: decide only on what
      // the admin saw.
      const name = kind === 'host' ? role.user.vendorProfile?.shopName : role.user.organizerProfile?.displayName;
      const links = (kind === 'host' ? role.user.vendorProfile?.socialLinks : role.user.organizerProfile?.socialLinks) ?? [];
      if ((name ?? role.user.fullName) !== seen.displayName || !sameLinks(links, seen.socialLinks)) {
        throw new ConflictException('This request changed since you opened it. Reload to see the new details.');
      }
      await changeApprovalStatus(tx, {
        roleId: role.id,
        from: role.approvalStatus,
        action,
        subject: kind,
        actorUserId: adminId,
        reason: decision.approve ? null : decision.reason,
        data: {
          reviewedBy: { connect: { id: adminId } },
          reviewedAt: new Date(),
          rejectionReason: decision.approve ? null : decision.reason,
          reviewedLinks: links as string[],
          ...(kind === 'host' ? { approvalSource: decision.approve ? 'reviewed' : null } : {}),
          ...(decision.note !== undefined && decision.note !== null ? { adminNotes: decision.note } : {}),
        },
      });
      const fullName = role.user.fullName;
      if (kind === 'host') {
        await this.outbox.queue(tx, {
          userId,
          toEmail: role.user.email,
          type: decision.approve ? 'host_approved' : 'host_rejected',
          relatedEntityType: 'user_role',
          relatedEntityId: role.id,
          payload: decision.approve
            ? { name: fullName, shopName: name ?? fullName, url: `${config.webUrl}/vendor/popups`, supportEmail: config.supportEmail }
            : { name: fullName, reason: decision.reason, url: `${config.webUrl}/vendor/host-approval`, supportEmail: config.supportEmail },
        });
        // The badge shows on the host's pop-ups and their cards.
        const vendorId = role.user.vendorProfile?.id;
        if (!vendorId) return [];
        const popups = await tx.event.findMany({ where: { hostVendorProfileId: vendorId }, select: { id: true } });
        return [tags.vendor(vendorId), tags.listing, ...popups.map((e) => tags.event(e.id))];
      }
      await this.outbox.queue(tx, {
        userId,
        // The contact email the organizer gave for their approval (spec §2.1).
        toEmail: role.contactEmail ?? role.user.email,
        type: decision.approve ? 'organizer_approved' : 'organizer_rejected',
        relatedEntityType: 'user_role',
        relatedEntityId: role.id,
        payload: decision.approve
          ? { name: fullName, displayName: role.user.organizerProfile?.displayName ?? fullName, url: `${config.webUrl}/organizer`, supportEmail: config.supportEmail }
          : { name: fullName, reason: decision.reason, url: `${config.webUrl}/organizer/approval`, supportEmail: config.supportEmail },
      });
      // The "Approved by Creavent" seal shows on the organizer's pages and cards.
      const profileId = role.user.organizerProfile?.id;
      return profileId ? [tags.organizer(profileId), tags.listing] : [];
    });
    if (refresh.length) void this.refresh.refresh(refresh);
    return this.detail(userId, kind);
  }
}
