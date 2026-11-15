import { Injectable, NotFoundException } from '@nestjs/common';
import {
  manilaParts,
  vendorStatus,
  type ApplicationCard,
  type ApplicationDetail,
  type ApplicationFilter,
  type OrganizerApplications,
  type organizerApplicationsQuerySchema,
} from '@creavent/shared';
import type { z } from 'zod';
import { organizerProfile } from '../events/organizer-events.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { FilesService } from '../files/files.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { approvedPerCategory } from './category-counts.js';
import { ACTIVE, takenSlotIds } from './slot-status.js';

const include = {
  event: { include: { documents: true } },
  vendorProfile: { include: { user: { include: { avatarFile: true } } } },
  categories: { include: { category: true } },
  documents: { include: { file: true } },
  preferredSlot: true,
  assignments: { where: { status: { in: [...ACTIVE] } }, include: { slot: true, payment: true } },
} satisfies Prisma.ApplicationInclude;

type Row = Prisma.ApplicationGetPayload<{ include: typeof include }>;

const day = (d: Date | null) => (d ? manilaParts(d).date : null);

// Every application to the organizer's events in one place (decided
// 2026-11-15), and one application in full.
@Injectable()
export class OrganizerAllApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async list(userId: string, query: z.output<typeof organizerApplicationsQuerySchema>): Promise<OrganizerApplications> {
    const profile = await organizerProfile(this.prisma, userId);
    const mine: Prisma.ApplicationWhereInput = {
      event: { organizerProfileId: profile.id },
      ...(query.eventId ? { eventId: query.eventId } : {}),
      ...(query.q ? { vendorProfile: { shopName: { contains: query.q, mode: 'insensitive' } } } : {}),
    };
    const rows = await this.prisma.application.findMany({ where: mine, include, orderBy: { submittedAt: 'asc' } });
    const taken = new Map<string, Set<string>>();
    for (const eventId of new Set(rows.map((r) => r.eventId))) taken.set(eventId, await takenSlotIds(this.prisma, eventId));
    const cards = rows.map((r) => this.card(r, taken.get(r.eventId)!));
    const counts = Object.fromEntries(
      (['waiting', 'approved_no_slot', 'slot_assigned', 'reserved', 'declined', 'withdrawn', 'removed', 'all'] as const).map((f) => [f, cards.filter((c) => matches(c.stage, f)).length]),
    ) as Record<ApplicationFilter, number>;

    const events = await this.prisma.event.findMany({
      where: { organizerProfileId: profile.id, status: { in: ['open_to_vendors', 'announced'] } },
      orderBy: { startsAt: 'asc' },
      include: { _count: { select: { slots: { where: { deletedAt: null } }, assignments: { where: { status: { in: [...ACTIVE] } } } } } },
    });
    const proofs = await this.prisma.paymentProof.findMany({
      where: { status: 'submitted', archivedAt: null, event: { organizerProfileId: profile.id } },
      select: { payment: { select: { amountDue: true } } },
    });
    const waiting = cards.filter((c) => c.stage === 'submitted');
    return {
      summary: {
        waiting: waiting.length,
        oldestWaitingAt: waiting[0]?.submittedAt ?? null,
        approvedNoSlot: counts.approved_no_slot,
        openSlots: events.reduce((n, e) => n + e._count.slots - e._count.assignments, 0),
        proofsToCheck: proofs.length,
        proofsTotal: proofs.reduce((n, p) => n + Number(p.payment.amountDue), 0),
      },
      counts,
      events: events.map((e) => ({ id: e.id, name: e.name, startDate: day(e.startsAt) })),
      applications: cards.filter((c) => matches(c.stage, query.status)),
    };
  }

  async waitingCount(userId: string) {
    const profile = await organizerProfile(this.prisma, userId);
    return { waiting: await this.prisma.application.count({ where: { status: 'submitted', event: { organizerProfileId: profile.id } } }) };
  }

  async detail(userId: string, applicationId: string): Promise<ApplicationDetail> {
    const profile = await organizerProfile(this.prisma, userId);
    const a = await this.prisma.application.findFirst({
      where: { id: applicationId, event: { organizerProfileId: profile.id } },
      include: {
        ...include,
        event: { include: { documents: true, vendorFloorPlanFile: true, categories: { include: { category: true } } } },
        vendorProfile: { include: { user: { include: { avatarFile: true } }, photos: { include: { file: true }, orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!a) throw new NotFoundException('Application not found');
    const [taken, approved, others, history, next] = await Promise.all([
      takenSlotIds(this.prisma, a.eventId),
      approvedPerCategory(this.prisma, a.eventId),
      a.preferredSlotId
        ? this.prisma.application.count({ where: { eventId: a.eventId, preferredSlotId: a.preferredSlotId, status: { in: ['submitted', 'approved'] }, id: { not: a.id } } })
        : Promise.resolve(0),
      this.prisma.application.findMany({ where: { eventId: a.eventId, vendorProfileId: a.vendorProfileId, id: { not: a.id } }, orderBy: { submittedAt: 'asc' } }),
      this.prisma.application.findFirst({
        where: { status: 'submitted', event: { organizerProfileId: profile.id }, id: { not: a.id }, submittedAt: { gte: a.submittedAt } },
        orderBy: { submittedAt: 'asc' },
        select: { id: true },
      }),
    ]);
    const active = a.assignments[0] ?? null;
    const picked = new Set(a.categories.map((c) => c.categoryId));
    const fallback = a.event.defaultSlotPrice === null ? null : Number(a.event.defaultSlotPrice);
    const v = a.vendorProfile;
    return {
      id: a.id,
      stage: vendorStatus(a.status, active ? (active.status as 'assigned' | 'reserved') : null),
      submittedAt: a.submittedAt.toISOString(),
      decidedAt: a.decidedAt?.toISOString() ?? null,
      decisionNote: a.decisionNote,
      note: a.vendorNote,
      removalNote: a.removalNote,
      canReapply: a.canReapply,
      policyAcceptedAt: a.policyAcceptedAt.toISOString(),
      event: {
        id: a.event.id,
        name: a.event.name,
        slug: a.event.slug,
        startDate: day(a.event.startsAt),
        endDate: day(a.event.endsAt),
        preferredSlots: a.event.slotMode === 'vendor_preference',
        vendorFloorPlanUrl: a.event.vendorFloorPlanFile ? this.files.url(a.event.vendorFloorPlanFile.storageKey) : null,
      },
      vendor: {
        shopName: v.shopName,
        slug: v.slug,
        avatarUrl: v.user.avatarFile ? this.files.url(v.user.avatarFile.storageKey) : null,
        description: v.description,
        products: v.products,
        photoUrls: v.photos.map((p) => this.files.url(p.file.storageKey)),
        fullName: v.user.fullName,
        phone: v.user.phone,
      },
      categories: a.event.categories
        .filter((c) => picked.has(c.categoryId))
        .map((c) => ({ name: c.category.name, approved: approved.get(c.categoryId) ?? 0, max: c.maxVendors })),
      documents: a.documents
        .filter((d) => !d.file.deletedAt)
        .map((d) => ({
          id: d.id,
          name: a.event.documents.find((r) => r.id === d.requirementId)?.name ?? 'Other document',
          url: this.files.fileUrl(d.file),
          isPdf: d.file.mimeType === 'application/pdf',
          uploadedAt: d.file.createdAt.toISOString(),
        })),
      missingDocuments: missing(a),
      preferredSlot: a.preferredSlot
        ? {
            label: a.preferredSlot.label,
            section: a.preferredSlot.section,
            sizeLabel: a.preferredSlot.sizeLabel,
            price: a.preferredSlot.price === null ? fallback : Number(a.preferredSlot.price),
            state: a.preferredSlot.deletedAt ? 'removed' : taken.has(a.preferredSlot.id) ? 'taken' : 'open',
            preferredByOthers: others,
          }
        : null,
      assignment: active
        ? {
            status: active.status,
            slotLabel: active.slot.label,
            amountDue: Number(active.priceLocked),
            paymentStatus: active.payment?.status ?? 'pending',
            deadlineAt: active.deadlineAt.toISOString(),
          }
        : null,
      history: history.map((h) => ({ id: h.id, status: h.status, submittedAt: h.submittedAt.toISOString() })),
      nextWaitingId: next?.id ?? null,
    };
  }

  private card(r: Row, taken: Set<string>): ApplicationCard {
    const active = r.assignments[0] ?? null;
    const docs = r.documents.filter((d) => !d.file.deletedAt);
    return {
      id: r.id,
      eventId: r.eventId,
      eventName: r.event.name,
      eventStartDate: day(r.event.startsAt),
      stage: vendorStatus(r.status, active ? (active.status as 'assigned' | 'reserved') : null),
      shopName: r.vendorProfile.shopName,
      avatarUrl: r.vendorProfile.user.avatarFile ? this.files.url(r.vendorProfile.user.avatarFile.storageKey) : null,
      categories: r.categories.map((c) => c.category.name),
      documents: { count: docs.length, pdfs: docs.filter((d) => d.file.mimeType === 'application/pdf').length, missing: missing(r) },
      submittedAt: r.submittedAt.toISOString(),
      preferredSlot: r.preferredSlot
        ? { label: r.preferredSlot.label, state: r.preferredSlot.deletedAt ? 'removed' : taken.has(r.preferredSlot.id) ? 'taken' : 'open' }
        : null,
      slotLabel: active?.slot.label ?? null,
    };
  }
}

// Required documents for the picked categories with no file (spec §3.2).
function missing(r: { categories: { categoryId: string }[]; documents: { requirementId: string | null }[]; event: { documents: { id: string; name: string; categoryId: string | null; isRequired: boolean }[] } }) {
  const picked = new Set(r.categories.map((c) => c.categoryId));
  const given = new Set(r.documents.map((d) => d.requirementId));
  return r.event.documents.filter((d) => d.isRequired && (d.categoryId === null || picked.has(d.categoryId)) && !given.has(d.id)).map((d) => d.name);
}

function matches(stage: ApplicationCard['stage'], filter: ApplicationFilter) {
  if (filter === 'all') return true;
  if (filter === 'waiting') return stage === 'submitted';
  if (filter === 'approved_no_slot') return stage === 'approved';
  return stage === filter;
}
