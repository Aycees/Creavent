import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
  reportNumber,
  type ReportButtonTarget,
  type ReportDetail,
  type ReportGroup,
  type ReportTarget,
  type ReportTargetSummary,
} from '@creavent/shared';
import type { z } from 'zod';
import type { addEmailReportSchema, createReportSchema, resolveReportSchema } from '@creavent/shared';
import { writeAuditLog } from '../audit/audit-log.js';
import { Prisma, type ReportAction, type ReportReason, type ReportSource, type ReportStatus } from '../generated/prisma/client.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublicRefreshService } from '../public/public-refresh.service.js';

const MAX_REPORTS_PER_HOUR = 10;
// Reports in the Resolved list.
const RESOLVED_LIMIT = 200;

export const statusWords: Record<string, string> = {
  draft: 'draft',
  open_to_vendors: 'open to vendors',
  announced: 'announced',
  completed: 'completed',
  canceled: 'canceled',
};

// What the admin pages need about a target.
const targetInclude = {
  targetEvent: {
    include: {
      organizerProfile: { include: { user: { include: { roles: true } } } },
      hostVendorProfile: { include: { user: { include: { roles: true } } } },
    },
  },
  targetUser: { include: { roles: true, vendorProfile: true, organizerProfile: true } },
} satisfies Prisma.ReportInclude;

type ReportRow = Prisma.ReportGetPayload<{
  include: typeof targetInclude & {
    reporter: { include: { roles: true; vendorProfile: true; organizerProfile: true } };
    createdBy: true;
    resolvedBy: true;
  };
}>;

type UserWithProfiles = { fullName: string; roles: { role: string }[]; vendorProfile: { shopName: string } | null; organizerProfile: { displayName: string } | null };

// "Vendor, Kalye Kicks · Organizer, Mega Sale DVO".
export function describeRoles(u: UserWithProfiles) {
  const parts = u.roles
    .slice()
    .sort((a, b) => a.role.localeCompare(b.role))
    .map((r) =>
      r.role === 'vendor'
        ? `Vendor${u.vendorProfile ? `, ${u.vendorProfile.shopName}` : ''}`
        : `Organizer${u.organizerProfile ? `, ${u.organizerProfile.displayName}` : ''}`,
    );
  return parts.join(' · ') || 'No roles';
}

const targetKey = (r: { targetType: ReportTarget; targetUserId: string | null; targetEventId: string | null }) =>
  `${r.targetType}:${r.targetUserId ?? r.targetEventId}`;

// Reports (spec §2.2): the report button, reports added from the support
// inbox, and one decision for every open report about the same target.
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly refresh: PublicRefreshService,
  ) {}

  async create(userId: string, input: z.output<typeof createReportSchema>) {
    const target = await this.publicTarget(input.targetType, input.targetId);
    if (!target) throw new NotFoundException(input.targetType === 'event' ? 'Event not found' : 'Page not found');
    if (target.ownerUserId === userId) throw new BadRequestException(input.targetType === 'event' ? "You can't report your own event" : "You can't report your own page");
    try {
      return await this.prisma.$transaction(async (tx) => {
        // One reporter's requests run one at a time, so the hourly limit
        // (architecture §10, counted in the database like uploads) holds
        // against requests sent together.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`report:${userId}`}::text))`;
        const lastHour = await tx.report.count({ where: { reporterUserId: userId, createdAt: { gt: new Date(Date.now() - 3_600_000) } } });
        if (lastHour >= MAX_REPORTS_PER_HOUR) throw new HttpException('You sent a lot of reports in the last hour. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
        const existing = await tx.report.findFirst({ where: { reporterUserId: userId, status: 'open', ...target.where } });
        if (existing) throw alreadyReported(existing.number);
        const report = await tx.report.create({
          data: { source: 'report_button', reporterUserId: userId, targetType: target.type, ...target.where, reason: input.reason, details: input.details ?? null },
        });
        return { number: report.number };
      });
    } catch (error) {
      // Two reports sent at once: the partial unique index keeps one.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const report = await this.prisma.report.findFirstOrThrow({ where: { reporterUserId: userId, status: 'open', ...target.where } });
        throw alreadyReported(report.number);
      }
      throw error;
    }
  }

  async mine(userId: string, targetType: ReportButtonTarget, targetId: string) {
    const target = await this.publicTarget(targetType, targetId);
    if (!target) return { number: null, own: false };
    const report = await this.prisma.report.findFirst({ where: { reporterUserId: userId, status: 'open', ...target.where } });
    return { number: report?.number ?? null, own: target.ownerUserId === userId };
  }

  // What the report button points at, as visitors see it: an event that is
  // public, or an organizer or vendor page that is shown. Null otherwise, so
  // ids of drafts, hidden events and pages that are down can't be probed.
  private async publicTarget(type: ReportButtonTarget, id: string) {
    if (type === 'event') {
      const event = await this.prisma.event.findUnique({ where: { id }, include: { organizerProfile: true, hostVendorProfile: true } });
      if (!event || event.status === 'draft' || event.moderationState === 'hidden') return null;
      return { type: 'event' as const, where: { targetEventId: id }, ownerUserId: (event.organizerProfile ?? event.hostVendorProfile)!.userId };
    }
    const profile =
      type === 'organizer'
        ? await this.prisma.organizerProfile.findUnique({ where: { id }, select: { userId: true, slug: true } })
        : await this.prisma.vendorProfile.findUnique({ where: { id }, select: { userId: true, slug: true } });
    if (!profile?.slug) return null;
    const role = await this.prisma.userRole.findFirst({ where: { userId: profile.userId, role: type, suspendedAt: null, user: { deletedAt: null } } });
    if (!role) return null;
    return { type: 'user' as const, where: { targetUserId: profile.userId }, ownerUserId: profile.userId };
  }

  async addFromEmail(adminId: string, input: z.output<typeof addEmailReportSchema>) {
    await this.assertExists(input.targetType, input.targetId);
    const report = await this.prisma.report.create({
      data: {
        source: 'support_email',
        reporterEmail: input.reporterEmail,
        createdById: adminId,
        targetType: input.targetType,
        ...targetWhere(input.targetType, input.targetId),
        reason: input.reason,
        details: input.details,
      },
    });
    return { number: report.number };
  }

  // Open: one group per target, oldest first. Resolved: one group per
  // decision, newest first.
  async groups(status: 'open' | 'resolved'): Promise<{ items: ReportGroup[]; openCount: number; resolvedCount: number }> {
    // Resolved: the latest decisions only, so the list stays a fixed size.
    const rows =
      status === 'open'
        ? await this.prisma.report.findMany({ where: { status: 'open' }, include: targetInclude, orderBy: [{ createdAt: 'asc' }, { number: 'asc' }] })
        : (
            await this.prisma.report.findMany({
              where: { status: { not: 'open' } },
              include: targetInclude,
              orderBy: [{ resolvedAt: 'desc' }, { number: 'desc' }],
              take: RESOLVED_LIMIT,
            })
          ).reverse();
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = status === 'open' ? targetKey(r) : `${targetKey(r)}:${r.resolvedAt?.toISOString()}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    const items = [...groups.values()].map((g) => toGroup(g));
    if (status === 'resolved') items.sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''));
    const [openCount, resolvedCount] = await Promise.all([this.countGroups(true), this.countGroups(false)]);
    return { items, openCount, resolvedCount };
  }

  private async countGroups(open: boolean) {
    const [row] = open
      ? await this.prisma.$queryRaw<{ n: bigint }[]>`
          SELECT count(DISTINCT (target_type, target_user_id, target_event_id))::bigint AS n FROM reports WHERE status = 'open'`
      : await this.prisma.$queryRaw<{ n: bigint }[]>`
          SELECT count(DISTINCT (target_type, target_user_id, target_event_id, resolved_at))::bigint AS n FROM reports WHERE status <> 'open'`;
    return Number(row?.n ?? 0);
  }

  async detail(id: string): Promise<ReportDetail> {
    const group = await this.group(id);
    const first = group[0]!;
    const summary = summarize(first);
    return {
      id: first.id,
      status: first.status,
      actionTaken: first.actionTaken,
      resolvedAt: first.resolvedAt?.toISOString() ?? null,
      resolvedByName: first.resolvedBy?.fullName ?? null,
      resolutionNote: first.resolutionNote,
      target: {
        ...summary,
        organizer: first.targetEvent?.organizerProfile
          ? {
              userId: first.targetEvent.organizerProfile.userId,
              name: first.targetEvent.organizerProfile.displayName,
              suspended: first.targetEvent.organizerProfile.user.roles.some((r) => r.role === 'organizer' && r.suspendedAt !== null),
            }
          : null,
        host: hostOf(first),
        hidden: first.targetEvent?.moderationState === 'hidden',
        roles: first.targetUser
          ? first.targetUser.roles
              .slice()
              .sort((a, b) => a.role.localeCompare(b.role))
              .map((r) => ({
                role: r.role,
                name: r.role === 'vendor' ? (first.targetUser!.vendorProfile?.shopName ?? null) : (first.targetUser!.organizerProfile?.displayName ?? null),
                suspended: r.suspendedAt !== null,
              }))
          : [],
      },
      reports: group.map((r) => ({
        number: r.number,
        reason: r.reason,
        details: r.details,
        source: r.source,
        reporter: r.reporter ? `${r.reporter.fullName} (${describeRoles(r.reporter).replace(/\b(Vendor|Organizer)\b/g, (w) => w.toLowerCase())})` : (r.reporterEmail ?? 'Unknown'),
        addedBy: r.createdBy?.fullName ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  // The report and the others decided with it: every open report about the
  // same target, or the ones resolved in the same decision.
  private async group(id: string): Promise<ReportRow[]> {
    const include = { ...targetInclude, reporter: { include: { roles: true, vendorProfile: true, organizerProfile: true } }, createdBy: true, resolvedBy: true };
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    return this.prisma.report.findMany({
      where: {
        targetType: report.targetType,
        targetUserId: report.targetUserId,
        targetEventId: report.targetEventId,
        ...(report.status === 'open' ? { status: 'open' } : { status: { not: 'open' }, resolvedAt: report.resolvedAt }),
      },
      include,
      orderBy: [{ createdAt: 'asc' }, { number: 'asc' }],
    });
  }

  async resolve(adminId: string, id: string, input: z.output<typeof resolveReportSchema>) {
    const refresh = await this.prisma.$transaction(async (tx) => {
      const found = await tx.report.findUnique({ where: { id } });
      if (!found) throw new NotFoundException('Report not found');
      // Lock every report about this target, so two admins deciding the same
      // group through different reports wait for each other (flow 11).
      await tx.$queryRaw`
        SELECT id FROM reports
        WHERE target_type = ${found.targetType}::report_target
          AND target_user_id IS NOT DISTINCT FROM ${found.targetUserId}::uuid
          AND target_event_id IS NOT DISTINCT FROM ${found.targetEventId}::uuid
        FOR UPDATE`;
      const report = await tx.report.findUniqueOrThrow({
        where: { id },
        include: { targetEvent: { include: { organizerProfile: true, hostVendorProfile: true } } },
      });
      if (report.status !== 'open') throw new ConflictException('These reports were already resolved. Reload to see the decision.');

      let refresh: string[] = [];
      let action: ReportAction = 'none';
      const status: ReportStatus = input.decision === 'dismiss' ? 'dismissed' : 'actioned';
      if (input.decision === 'hide_event') {
        if (report.targetType !== 'event') throw new BadRequestException('Only an event report can hide an event');
        // Already hidden from the events page: record the decision only.
        if (report.targetEvent!.moderationState !== 'hidden') refresh = await this.moderation.hideEvent(tx, adminId, report.targetEventId!, input.reason);
        action = 'event_hidden';
      } else if (input.decision === 'suspend_role') {
        const popupHost = report.targetEvent?.hostVendorProfile;
        const userId = report.targetType === 'event' ? (report.targetEvent!.organizerProfile ?? popupHost)!.userId : report.targetUserId!;
        if (report.targetType === 'event' && input.role !== (popupHost ? 'vendor' : 'organizer')) {
          throw new BadRequestException(popupHost ? "A pop-up report can suspend only the host's vendor role" : 'An event report can suspend only the organizer role');
        }
        const role = await tx.userRole.findUnique({ where: { userId_role: { userId, role: input.role } } });
        if (!role) throw new BadRequestException(`This user has no ${input.role} role`);
        // Already suspended from the user's page: record the decision only.
        if (!role.suspendedAt) {
          refresh = await this.moderation.suspendRole(tx, adminId, userId, input.role, input.reason, { hideUpcomingEvents: input.hideUpcomingEvents });
        }
        action = 'user_suspended';
      } else if (input.decision === 'revoke_host') {
        const userId = report.targetType === 'event' ? report.targetEvent!.hostVendorProfile?.userId : report.targetUserId!;
        if (!userId) throw new BadRequestException('Only a pop-up or a vendor report can revoke host approval');
        const role = await tx.userRole.findUnique({ where: { userId_role: { userId, role: 'vendor' } } });
        if (role?.approvalStatus !== 'approved') throw new BadRequestException('This vendor is not approved to host pop-ups');
        refresh = await this.moderation.revokeHost(tx, adminId, userId, input.reason);
        action = 'host_approval_revoked';
      }

      const resolvedAt = new Date();
      const open = await tx.report.findMany({
        where: { status: 'open', targetType: report.targetType, targetUserId: report.targetUserId, targetEventId: report.targetEventId },
        select: { id: true },
      });
      await tx.report.updateMany({
        where: { id: { in: open.map((r) => r.id) } },
        data: { status, actionTaken: action, resolvedById: adminId, resolvedAt, resolutionNote: input.note ?? null },
      });
      for (const r of open) {
        await writeAuditLog(tx, {
          actorUserId: adminId,
          action: 'report.resolve',
          entityType: 'report',
          entityId: r.id,
          changes: { status: { from: 'open', to: status }, actionTaken: action },
          reason: input.note ?? null,
        });
      }
      return refresh;
    });
    if (refresh.length) void this.refresh.refresh(refresh);
    return this.detail(id);
  }

  private async assertExists(type: ReportTarget, id: string) {
    if (type === 'event') {
      if (!(await this.prisma.event.findUnique({ where: { id } }))) throw new NotFoundException('Event not found');
      return;
    }
    const roles = await this.prisma.userRole.count({ where: { userId: id, user: { deletedAt: null } } });
    if (!roles) throw new NotFoundException('User not found');
  }
}

function alreadyReported(n: number) {
  return new ConflictException(`You already reported this. Your reference is ${reportNumber(n)}.`);
}

function targetWhere(type: ReportTarget, id: string) {
  return type === 'event' ? { targetEventId: id } : { targetUserId: id };
}

type TargetRow = Prisma.ReportGetPayload<{ include: typeof targetInclude }>;

function summarize(r: TargetRow): ReportTargetSummary {
  if (r.targetType === 'event' && r.targetEvent) {
    const e = r.targetEvent;
    return {
      type: 'event',
      id: e.id,
      name: e.name,
      subtitle: `${e.organizerProfile?.displayName ?? `Pop-up by ${e.hostVendorProfile!.shopName}`} · ${statusWords[e.status] ?? e.status}${e.moderationState === 'hidden' ? ', hidden' : ''}`,
      startsAt: e.startsAt?.toISOString() ?? null,
    };
  }
  const u = r.targetUser!;
  return { type: 'user', id: u.id, name: u.fullName, subtitle: describeRoles(u), startsAt: null };
}

// The vendor a host action applies to: a pop-up's host, or a reported user
// with the vendor role.
function hostOf(r: TargetRow) {
  const fromEvent = r.targetEvent?.hostVendorProfile;
  if (fromEvent) {
    const role = fromEvent.user.roles.find((x) => x.role === 'vendor');
    return { userId: fromEvent.userId, name: fromEvent.shopName, suspended: role?.suspendedAt != null, approved: role?.approvalStatus === 'approved' };
  }
  const role = r.targetUser?.roles.find((x) => x.role === 'vendor');
  if (!r.targetUser || !role) return null;
  return { userId: r.targetUser.id, name: r.targetUser.vendorProfile?.shopName ?? r.targetUser.fullName, suspended: role.suspendedAt !== null, approved: role.approvalStatus === 'approved' };
}

function toGroup(rows: (TargetRow & { reason: ReportReason; source: ReportSource })[]): ReportGroup {
  const first = rows[0]!;
  return {
    id: first.id,
    target: summarize(first),
    count: rows.length,
    reasons: [...new Set(rows.map((r) => r.reason))],
    fromEmail: rows.some((r) => r.source === 'support_email'),
    oldestAt: first.createdAt.toISOString(),
    status: first.status,
    actionTaken: first.actionTaken,
    resolvedAt: first.resolvedAt?.toISOString() ?? null,
  };
}

