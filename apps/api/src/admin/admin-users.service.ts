import { Injectable, NotFoundException } from '@nestjs/common';
import { ADMIN_PAGE_SIZE, reportNumber, type AdminUser, type AdminUsers, type AdminUsersFilter, type RoleType } from '@creavent/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { ModerationService, upcomingEvents } from '../moderation/moderation.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toHostApproval } from '../popups/host-approval.service.js';
import { PublicRefreshService } from '../public/public-refresh.service.js';

const roleWord: Record<string, string> = { vendor: 'Vendor', organizer: 'Organizer' };

// The audit log actions shown in a user's history, in words.
const actionWords: Record<string, string> = {
  'user_role.suspend': 'role suspended',
  'user_role.reinstate': 'role reinstated',
  'organizer_approval.approve': 'approved',
  'organizer_approval.reject': 'rejected',
  'host_approval.approve': 'approved to host pop-ups',
  'host_approval.reject': 'not approved to host pop-ups',
  'host_approval.revoke': 'host approval revoked',
};

export function searchUsers(q: string | undefined): Prisma.UserWhereInput {
  if (!q) return {};
  const contains = { contains: q, mode: 'insensitive' as const };
  return { OR: [{ fullName: contains }, { email: contains }, { vendorProfile: { shopName: contains } }, { organizerProfile: { displayName: contains } }] };
}

// /admin/users (sitemap §6): search, roles, and suspend or reinstate each role.
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly refresh: PublicRefreshService,
  ) {}

  async list(query: { q?: string; filter: AdminUsersFilter; page: number }): Promise<AdminUsers> {
    // People with a role. Admins without one are the team, not users.
    const base: Prisma.UserWhereInput = { deletedAt: null, roles: { some: {} }, ...searchUsers(query.q) };
    const filters: Record<AdminUsersFilter, Prisma.UserWhereInput> = {
      all: base,
      vendors: { ...base, roles: { some: { role: 'vendor' } } },
      organizers: { ...base, roles: { some: { role: 'organizer' } } },
      suspended: { ...base, roles: { some: { suspendedAt: { not: null } } } },
    };
    const where = filters[query.filter];
    const [users, total, all, vendors, organizers, suspended] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { roles: true, vendorProfile: true, organizerProfile: true, _count: { select: { reportsAbout: { where: { status: 'open' } } } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * ADMIN_PAGE_SIZE,
        take: ADMIN_PAGE_SIZE,
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: filters.all }),
      this.prisma.user.count({ where: filters.vendors }),
      this.prisma.user.count({ where: filters.organizers }),
      this.prisma.user.count({ where: filters.suspended }),
    ]);
    return {
      items: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        joinedAt: u.createdAt.toISOString(),
        roles: roleSummaries(u),
        openReports: u._count.reportsAbout,
      })),
      total,
      page: query.page,
      pageSize: ADMIN_PAGE_SIZE,
      counts: { all, vendors, organizers, suspended },
    };
  }

  async detail(id: string): Promise<AdminUser> {
    const u = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        roles: { include: { suspendedBy: true } },
        vendorProfile: { include: { popups: { orderBy: [{ startsAt: { sort: 'desc', nulls: 'first' } }] } } },
        organizerProfile: {
          include: {
            events: {
              include: {
                _count: { select: { applications: true, assignments: { where: { status: 'reserved' } } } },
              },
              orderBy: [{ startsAt: { sort: 'desc', nulls: 'first' } }],
            },
          },
        },
        reportsAbout: { include: { createdBy: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!u) throw new NotFoundException('User not found');
    const applications = u.vendorProfile
      ? await this.prisma.application.findMany({
          where: { vendorProfileId: u.vendorProfile.id },
          include: {
            event: true,
            assignments: { where: { status: { in: ['assigned', 'reserved'] } }, include: { slots: { where: { active: true }, include: { slot: true } } } },
          },
          orderBy: { submittedAt: 'desc' },
        })
      : [];
    // Reports the user is part of, by the events they organize too.
    const popups = u.vendorProfile?.popups ?? [];
    const eventIds = [...(u.organizerProfile?.events.map((e) => e.id) ?? []), ...popups.map((e) => e.id)];
    const eventReports = eventIds.length
      ? await this.prisma.report.findMany({ where: { targetEventId: { in: eventIds } }, include: { targetEvent: true }, orderBy: { createdAt: 'desc' } })
      : [];
    const logs = await this.prisma.auditLog.findMany({
      where: { entityType: 'user_role', entityId: { in: u.roles.map((r) => r.id) } },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
    });
    const upcomingCount = u.organizerProfile ? (await upcomingEvents(this.prisma, u.organizerProfile.id)).length : 0;
    const roleOf = new Map(u.roles.map((r) => [r.id, r.role]));
    const vendorRole = u.roles.find((r) => r.role === 'vendor');
    const hostStatus = vendorRole?.approvalStatus ?? 'not_submitted';
    // An earned approval came from a reserved slot at a completed event.
    const earnedFrom =
      hostStatus === 'approved' && vendorRole?.approvalSource === 'earned' && u.vendorProfile
        ? await this.prisma.slotAssignment.findFirst({
            where: { vendorProfileId: u.vendorProfile.id, status: 'reserved', event: { status: 'completed', moderationState: 'visible' } },
            include: { event: true },
            orderBy: { event: { endsAt: 'asc' } },
          })
        : null;

    const history = [
      ...logs.map((l) => ({
        at: l.createdAt,
        text: `${roleWord[roleOf.get(l.entityId) ?? ''] ?? 'Role'} ${actionWords[l.action] ?? l.action} by ${l.actor.fullName}`,
      })),
      ...u.reportsAbout.map((r) => ({
        at: r.createdAt,
        text: `Report ${reportNumber(r.number)} ${r.source === 'support_email' ? `added from email${r.createdBy ? ` by ${r.createdBy.fullName}` : ''}` : 'from the report button'}`,
      })),
      { at: u.createdAt, text: 'Joined' },
    ].sort((a, b) => b.at.getTime() - a.at.getTime());

    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      emailVerified: u.emailVerified,
      phone: u.phone,
      joinedAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      roles: roleSummaries(u).map((s) => {
        const r = u.roles.find((x) => x.role === s.role)!;
        return {
          ...s,
          slug: r.role === 'vendor' ? (u.vendorProfile?.slug ?? null) : (u.organizerProfile?.slug ?? null),
          reviewedAt: r.reviewedAt?.toISOString() ?? null,
          suspendedAt: r.suspendedAt?.toISOString() ?? null,
          suspendedByName: r.suspendedBy?.fullName ?? null,
          suspensionReason: r.suspensionReason,
          upcomingEvents: r.role === 'organizer' ? upcomingCount : 0,
        };
      }),
      events: (u.organizerProfile?.events ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        startsAt: e.startsAt?.toISOString() ?? null,
        status: e.status,
        hidden: e.moderationState === 'hidden',
        applied: e._count.applications,
        confirmed: e._count.assignments,
      })),
      applications: applications.map((a) => ({
        eventId: a.eventId,
        eventName: a.event.name,
        startsAt: a.event.startsAt?.toISOString() ?? null,
        status: a.assignments[0]?.status ?? a.status,
        slotLabels: a.assignments.flatMap((s) => s.slots.map((x) => x.slot.label)),
      })),
      host: vendorRole
        ? {
            status: hostStatus,
            source: hostStatus === 'approved' ? vendorRole.approvalSource : null,
            decidedAt: vendorRole.reviewedAt?.toISOString() ?? null,
            earnedFrom: earnedFrom?.event.name ?? null,
            rejectionReason: hostStatus === 'rejected' ? vendorRole.rejectionReason : null,
            revoked: toHostApproval(vendorRole, []).revoked,
            announcedPopups: popups.filter((e) => e.status === 'announced' && e.moderationState === 'visible').length,
          }
        : null,
      popups: popups.map((e) => ({ id: e.id, name: e.name, startsAt: e.startsAt?.toISOString() ?? null, status: e.status, hidden: e.moderationState === 'hidden' })),
      reports: [
        ...u.reportsAbout.map((r) => ({ id: r.id, number: r.number, reason: r.reason, open: r.status === 'open', about: u.fullName })),
        ...eventReports.map((r) => ({ id: r.id, number: r.number, reason: r.reason, open: r.status === 'open', about: r.targetEvent!.name })),
      ],
      history: history.map((h) => ({ at: h.at.toISOString(), text: h.text })),
    };
  }

  async suspend(adminId: string, userId: string, role: RoleType, reason: string, hideUpcomingEvents = false) {
    const refresh = await this.prisma.$transaction((tx) => this.moderation.suspendRole(tx, adminId, userId, role, reason, { hideUpcomingEvents }));
    void this.refresh.refresh(refresh);
    return this.detail(userId);
  }

  // Revoke pop-up host approval (spec §4.7), from the vendor's user page.
  async revokeHost(adminId: string, userId: string, reason: string) {
    const refresh = await this.prisma.$transaction((tx) => this.moderation.revokeHost(tx, adminId, userId, reason));
    void this.refresh.refresh(refresh);
    return this.detail(userId);
  }

  async reinstate(adminId: string, userId: string, role: RoleType) {
    const refresh = await this.prisma.$transaction((tx) => this.moderation.reinstateRole(tx, adminId, userId, role));
    void this.refresh.refresh(refresh);
    return this.detail(userId);
  }
}

function roleSummaries(u: {
  roles: { role: RoleType; approvalStatus: AdminUser['roles'][number]['approvalStatus']; suspendedAt: Date | null }[];
  vendorProfile: { shopName: string } | null;
  organizerProfile: { displayName: string } | null;
}) {
  return u.roles
    .slice()
    .sort((a, b) => b.role.localeCompare(a.role))
    .map((r) => ({
      role: r.role,
      name: r.role === 'vendor' ? (u.vendorProfile?.shopName ?? null) : (u.organizerProfile?.displayName ?? null),
      approvalStatus: r.approvalStatus,
      suspended: r.suspendedAt !== null,
    }));
}
