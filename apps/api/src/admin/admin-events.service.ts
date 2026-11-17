import { Injectable, NotFoundException } from '@nestjs/common';
import { ADMIN_PAGE_SIZE, reportNumber, type AdminEvent, type AdminEvents, type AdminEventsFilter } from '@creavent/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublicRefreshService } from '../public/public-refresh.service.js';

const fileWords: Record<string, string> = {
  'application_document.view': 'application document',
  'payment_proof.view': 'proof of payment',
};

// /admin/events (sitemap §6): every event, hide and show, and the files an
// admin opens from here (each view is logged by the files service).
@Injectable()
export class AdminEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly refresh: PublicRefreshService,
  ) {}

  async list(query: { q?: string; filter: AdminEventsFilter; page: number }): Promise<AdminEvents> {
    const contains = query.q ? { contains: query.q, mode: 'insensitive' as const } : null;
    const base: Prisma.EventWhereInput = contains
      ? { OR: [{ name: contains }, { organizerProfile: { displayName: contains } }, { hostVendorProfile: { shopName: contains } }] }
      : {};
    const filters: Record<AdminEventsFilter, Prisma.EventWhereInput> = {
      all: base,
      open: { ...base, status: 'open_to_vendors' },
      announced: { ...base, status: 'announced' },
      popups: { ...base, hostVendorProfileId: { not: null } },
      reported: { ...base, reports: { some: { status: 'open' } } },
      hidden: { ...base, moderationState: 'hidden' },
      drafts: { ...base, status: 'draft' },
    };
    const where = filters[query.filter];
    const [events, total, ...counts] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: {
          eventType: true,
          organizerProfile: true,
          hostVendorProfile: true,
          _count: {
            select: { slots: { where: { deletedAt: null } }, assignments: { where: { status: 'reserved' } }, reports: { where: { status: 'open' } } },
          },
        },
        orderBy: [{ startsAt: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
        skip: (query.page - 1) * ADMIN_PAGE_SIZE,
        take: ADMIN_PAGE_SIZE,
      }),
      this.prisma.event.count({ where }),
      ...(['all', 'open', 'announced', 'popups', 'reported', 'hidden', 'drafts'] as const).map((f) => this.prisma.event.count({ where: filters[f] })),
    ]);
    const [all, open, announced, popups, reported, hidden, drafts] = counts as number[];
    return {
      items: events.map((e) => ({
        id: e.id,
        name: e.name,
        startsAt: e.startsAt?.toISOString() ?? null,
        typeName: e.eventType.name,
        venueName: e.venueName,
        organizerName: e.organizerProfile?.displayName ?? e.hostVendorProfile!.shopName,
        isPopup: e.hostVendorProfileId !== null,
        status: e.status,
        hidden: e.moderationState === 'hidden',
        slots: e._count.slots,
        confirmed: e._count.assignments,
        openReports: e._count.reports,
      })),
      total,
      page: query.page,
      pageSize: ADMIN_PAGE_SIZE,
      counts: { all: all!, open: open!, announced: announced!, popups: popups!, reported: reported!, hidden: hidden!, drafts: drafts! },
    };
  }

  async detail(id: string): Promise<AdminEvent> {
    const e = await this.prisma.event.findUnique({
      where: { id },
      include: {
        moderatedBy: true,
        organizerProfile: { include: { user: { include: { roles: { where: { role: 'organizer' } } } } } },
        hostVendorProfile: { include: { user: { include: { roles: { where: { role: 'vendor' } } } } } },
        slots: { where: { deletedAt: null }, select: { id: true } },
        assignments: { select: { status: true } },
        applications: {
          include: {
            vendorProfile: true,
            documents: { include: { requirement: true, file: true } },
            assignments: {
              include: {
                slots: { where: { active: true }, include: { slot: true } },
                payment: { include: { proofs: { include: { file: true }, orderBy: { uploadedAt: 'asc' } } } },
              },
            },
          },
          orderBy: { submittedAt: 'asc' },
        },
        reports: { include: { createdBy: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!e) throw new NotFoundException('Event not found');
    const host = e.organizerProfile
      ? { userId: e.organizerProfile.userId, name: e.organizerProfile.displayName, user: e.organizerProfile.user }
      : { userId: e.hostVendorProfile!.userId, name: e.hostVendorProfile!.shopName, user: e.hostVendorProfile!.user };
    const role = host.user.roles[0];

    // Who opened which file, for the history (spec §2). Each view row holds
    // its event and shop, so it outlives the file.
    const logs = await this.prisma.auditLog.findMany({
      where: { OR: [{ entityType: 'event', entityId: id }, { entityType: 'file', changes: { path: ['eventId'], equals: id } }] },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
    });
    const history = [
      ...logs.map((l) => ({
        at: l.createdAt,
        text:
          l.action === 'event.hide'
            ? `Hidden by ${l.actor.fullName}`
            : l.action === 'event.show'
              ? `Shown again by ${l.actor.fullName}`
              : `${l.actor.fullName} viewed ${(l.changes as { shopName?: string } | null)?.shopName ?? 'a vendor'}'s ${fileWords[l.action] ?? 'file'}`,
      })),
      ...e.reports.map((r) => ({
        at: r.createdAt,
        text: `Report ${reportNumber(r.number)} ${r.source === 'support_email' ? 'added from email' : 'from the report button'}`,
      })),
      ...(e.announcedAt ? [{ at: e.announcedAt, text: 'Announced' }] : []),
      ...(e.openedToVendorsAt ? [{ at: e.openedToVendorsAt, text: 'Opened to vendors' }] : []),
      ...(e.canceledAt ? [{ at: e.canceledAt, text: 'Canceled' }] : []),
      { at: e.createdAt, text: 'Created as a draft' },
    ].sort((a, b) => b.at.getTime() - a.at.getTime());

    const openReports = e.reports.filter((r) => r.status === 'open');
    return {
      id: e.id,
      name: e.name,
      slug: e.slug,
      status: e.status,
      startsAt: e.startsAt?.toISOString() ?? null,
      venueName: e.venueName,
      city: e.city,
      hidden: e.moderationState === 'hidden',
      moderationReason: e.moderationState === 'hidden' ? e.moderationReason : null,
      moderatedAt: e.moderatedAt?.toISOString() ?? null,
      moderatedByName: e.moderatedBy?.fullName ?? null,
      isPopup: e.hostVendorProfileId !== null,
      organizer: {
        userId: host.userId,
        name: host.name,
        fullName: host.user.fullName,
        approved: role?.approvalStatus === 'approved',
        suspended: role?.suspendedAt != null,
      },
      slots: {
        total: e.slots.length,
        assigned: e.assignments.filter((a) => a.status === 'assigned').length,
        reserved: e.assignments.filter((a) => a.status === 'reserved').length,
      },
      applications: e.applications.map((a) => {
        const active = a.assignments.filter((s) => s.status === 'assigned' || s.status === 'reserved');
        return {
          id: a.id,
          shopName: a.vendorProfile.shopName,
          vendorUserId: a.vendorProfile.userId,
          status: active[0]?.status ?? a.status,
          slotLabels: active.flatMap((s) => s.slots.map((x) => x.slot.label)),
          documents: a.documents.filter((d) => !d.file.deletedAt).map((d) => ({ fileId: d.fileId, label: d.requirement?.name ?? 'Document' })),
          proofs: a.assignments
            .flatMap((s) => s.payment?.proofs ?? [])
            .filter((p) => !p.file.deletedAt)
            .map((p, i, all) => ({ fileId: p.fileId, label: all.length > 1 ? `Proof of payment ${i + 1}` : 'Proof of payment' })),
        };
      }),
      openReports: { count: openReports.length, reportId: openReports[0]?.id ?? null },
      history: history.map((h) => ({ at: h.at.toISOString(), text: h.text })),
    };
  }

  async hide(adminId: string, id: string, reason: string) {
    const refresh = await this.prisma.$transaction((tx) => this.moderation.hideEvent(tx, adminId, id, reason));
    void this.refresh.refresh(refresh);
    return this.detail(id);
  }

  async show(adminId: string, id: string) {
    const refresh = await this.prisma.$transaction((tx) => this.moderation.showEvent(tx, adminId, id));
    void this.refresh.refresh(refresh);
    return this.detail(id);
  }
}
