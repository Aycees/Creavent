import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  formatPriceRange,
  vendorStatus,
  groupSlots,
  manilaParts,
  paymentChannelLabels,
  type EventPage,
  type VendorEventCard,
  type vendorEventsQuerySchema,
} from '@creavent/shared';
import type { z } from 'zod';
import type { Prisma } from '../generated/prisma/client.js';
import type { SessionUser } from '../auth/auth.guard.js';
import { approvedPerCategory, spotsLeft } from '../applications/category-counts.js';
import { takenSlotIds } from '../applications/slot-status.js';
import { FilesService } from '../files/files.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublicPagesService } from '../public/public-pages.service.js';

const include = {
  eventType: true,
  coverFile: true,
  vendorFloorPlanFile: true,
  organizerProfile: { include: { logoFile: true, user: { include: { roles: { where: { role: 'organizer' as const } } } } } },
  categories: { include: { category: true } },
  documents: { include: { category: true }, orderBy: { sortOrder: 'asc' as const } },
  slots: { where: { deletedAt: null }, orderBy: [{ sortOrder: 'asc' as const }, { label: 'asc' as const }] },
  paymentMethods: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.EventInclude;

type FullEvent = Prisma.EventGetPayload<{ include: typeof include }>;

// What vendors see: Browse events and the vendor view of the event page
// (spec §4.2, sitemap §3).
@Injectable()
export class VendorEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly publicPages: PublicPagesService,
  ) {}

  // Visible events open to vendors or announced that haven't ended, soonest
  // first.
  async browse(userId: string, query: z.output<typeof vendorEventsQuerySchema>): Promise<{ events: VendorEventCard[] }> {
    const vendor = await vendorProfile(this.prisma, userId);
    const now = new Date();
    // Events that end today or later, by the Manila day (flow 4).
    const startOfToday = new Date(`${manilaParts(now).date}T00:00:00+08:00`);
    const where: Prisma.EventWhereInput = {
      status: { in: ['open_to_vendors', 'announced'] },
      moderationState: 'visible',
      ...(query.city ? { city: query.city } : {}),
      ...(query.q
        ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { venueName: { contains: query.q, mode: 'insensitive' } }] }
        : {}),
      // AND, so the date filter can't replace "ends today or later".
      AND: [{ endsAt: { gte: startOfToday } }, dateFilter(query.when, now)],
    };
    const events = await this.prisma.event.findMany({ where, include, orderBy: { startsAt: 'asc' }, take: 100 });
    const mine = new Set(vendor.categories.map((c) => c.categoryId));
    const ids = events.map((e) => e.id);
    // Approved applications per event and category, for spots left.
    const approvedRows = await this.prisma.applicationCategory.findMany({
      where: { application: { eventId: { in: ids }, status: 'approved' } },
      select: { categoryId: true, application: { select: { eventId: true } } },
    });
    const counts = new Map<string, Map<string, number>>();
    for (const row of approvedRows) {
      const perEvent = counts.get(row.application.eventId) ?? new Map<string, number>();
      perEvent.set(row.categoryId, (perEvent.get(row.categoryId) ?? 0) + 1);
      counts.set(row.application.eventId, perEvent);
    }
    const latest = await this.latestApplications(vendor.id, ids);
    return {
      events: events.map((e) => ({
        slug: e.slug,
        name: e.name,
        typeName: e.eventType.name,
        status: e.status,
        ...schedule(e),
        venueName: e.venueName,
        city: e.city,
        coverUrl: e.coverFile ? this.files.url(e.coverFile.storageKey) : null,
        organizer: this.organizer(e),
        feeRange: formatPriceRange(prices(e)),
        applicationsCloseAt: closeAt(e),
        acceptingApplications: accepting(e, now),
        preferredSlots: e.slotMode === 'vendor_preference',
        mySpots: spots(e, counts.get(e.id))
          .filter((c) => mine.has(c.id) && c.max !== null)
          .map((c) => ({ categoryName: c.name, left: c.left!, max: c.max! })),
        myStatus: latest.get(e.id)?.status ?? null,
      })),
    };
  }

  // The event page for one viewer (sitemap §3). Vendors see the vendor view
  // once the event is open to vendors; its organizer and admins see it at any
  // status. Drafts and hidden events are Not found to everyone else.
  // The event's organizer sees the public view with "Manage event", or the
  // vendor view with ?as=vendor (Preview as vendor), at any status. Vendors
  // see the vendor view; everyone else the public page (decision Q2).
  async page(viewer: SessionUser | undefined, slug: string, as?: string): Promise<EventPage> {
    const event = await this.prisma.event.findUnique({ where: { slug }, include });
    if (!event) throw new NotFoundException('Event not found');
    const isOrganizer = viewer !== undefined && event.organizerProfile.userId === viewer.id;
    const isAdmin = viewer?.isAdmin === true;
    if (isOrganizer && as !== 'vendor') {
      return { view: 'public', event: await this.publicPages.publicEventById(event.id), manage: { eventId: event.id } };
    }
    if (isOrganizer || isAdmin) return { view: 'vendor', preview: true, event: await this.vendorView(event, viewer!.id) };
    if (event.status === 'draft' || event.moderationState === 'hidden') throw new NotFoundException('Event not found');

    const vendor = viewer
      ? await this.prisma.userRole.findUnique({ where: { userId_role: { userId: viewer.id, role: 'vendor' } } })
      : null;
    if (vendor && !vendor.suspendedAt) return { view: 'vendor', preview: false, event: await this.vendorView(event, viewer!.id) };
    const { page } = await this.publicPages.event(slug);
    return page.view === 'public' ? { ...page, manage: null } : page;
  }

  private async vendorView(e: FullEvent, viewerId: string) {
    const now = new Date();
    const mine = await this.prisma.vendorProfileCategory.findMany({
      where: { vendorProfile: { userId: viewerId } },
      select: { categoryId: true },
      orderBy: { category: { sortOrder: 'asc' } },
    });
    const profile = await this.prisma.vendorProfile.findUnique({ where: { userId: viewerId }, select: { id: true } });
    const latest = profile ? (await this.latestApplications(profile.id, [e.id])).get(e.id) : undefined;
    const taken = await takenSlotIds(this.prisma, e.id);
    const defaultPrice = e.defaultSlotPrice === null ? null : Number(e.defaultSlotPrice);
    const channels = [...new Set(e.paymentMethods.map((m) => paymentChannelLabels[m.channel]))];
    return {
      slug: e.slug,
      name: e.name,
      typeName: e.eventType.name,
      status: e.status,
      ...schedule(e),
      venueName: e.venueName,
      addressLine: e.addressLine,
      city: e.city,
      description: e.description,
      coverUrl: e.coverFile ? this.files.url(e.coverFile.storageKey) : null,
      organizer: this.organizer(e),
      applicationsCloseAt: closeAt(e),
      acceptingApplications: accepting(e, now),
      categories: spots(e, await approvedPerCategory(this.prisma, e.id)),
      documents: e.documents.map((d) => ({ name: d.name, categoryName: d.category?.name ?? null })),
      preferredSlots: e.slotMode === 'vendor_preference',
      slotGroups: groupSlots(e.slots).map((g) => {
        const sizes = [...new Set(g.slots.flatMap((s) => s.sizeLabel ?? []))];
        const notes = [...new Set(g.slots.flatMap((s) => s.note ?? []))];
        const groupPrices = g.slots.flatMap((s) => (s.price === null ? (defaultPrice ?? []) : Number(s.price)));
        return {
          name: g.name,
          range: g.slots.length > 1 ? `${g.slots[0].label} to ${g.slots[g.slots.length - 1].label}` : g.slots[0].label,
          sizes: sizes.length ? sizes.join(', ') : null,
          notes: notes.length ? notes.join(', ') : null,
          feeRange: formatPriceRange(groupPrices),
          open: g.slots.filter((s) => !taken.has(s.id)).length,
          total: g.slots.length,
        };
      }),
      vendorFloorPlanUrl: e.vendorFloorPlanFile ? this.files.url(e.vendorFloorPlanFile.storageKey) : null,
      policy: e.policyText,
      summary: {
        feeRange: formatPriceRange(prices(e)),
        deadlineHours: e.paymentDeadlineHours,
        paidTo: channels.length ? channels.join(' or ') : null,
      },
      vendorContactInfo: e.vendorContactInfo,
      myCategoryIds: mine.map((c) => c.categoryId),
      myApplication: latest ?? null,
    };
  }

  // The vendor's latest application at each event, with the combined status.
  private async latestApplications(vendorProfileId: string, eventIds: string[]) {
    const applications = await this.prisma.application.findMany({
      where: { vendorProfileId, eventId: { in: eventIds } },
      orderBy: { submittedAt: 'desc' },
      select: { id: true, eventId: true, status: true, canReapply: true },
    });
    const latest = new Map<string, { id: string; status: ReturnType<typeof vendorStatus>; canReapply: boolean | null }>();
    for (const a of applications) {
      if (!latest.has(a.eventId)) latest.set(a.eventId, { id: a.id, status: vendorStatus(a.status), canReapply: a.canReapply });
    }
    return latest;
  }

  private organizer(e: FullEvent) {
    const role = e.organizerProfile.user.roles[0];
    return {
      displayName: e.organizerProfile.displayName,
      slug: e.organizerProfile.slug,
      logoUrl: e.organizerProfile.logoFile ? this.files.url(e.organizerProfile.logoFile.storageKey) : null,
      approved: role?.approvalStatus === 'approved' && role.suspendedAt === null,
    };
  }
}

async function vendorProfile(prisma: PrismaService, userId: string) {
  const role = await prisma.userRole.findUnique({ where: { userId_role: { userId, role: 'vendor' } } });
  if (!role) throw new ForbiddenException('Add the vendor role first');
  if (role.suspendedAt) throw new ForbiddenException('Your vendor role is suspended');
  const profile = await prisma.vendorProfile.findUnique({ where: { userId }, include: { categories: true } });
  if (!profile) throw new ForbiddenException('Finish your shop profile first');
  return profile;
}

function schedule(e: FullEvent) {
  const start = e.startsAt ? manilaParts(e.startsAt) : null;
  const end = e.endsAt ? manilaParts(e.endsAt) : null;
  return { startDate: start?.date ?? null, endDate: end?.date ?? null, opensAt: start?.time ?? null, closesAt: end?.time ?? null };
}

function closeAt(e: FullEvent) {
  if (!e.applicationsCloseAt) return null;
  const p = manilaParts(e.applicationsCloseAt);
  return `${p.date}T${p.time}`;
}

// "Accepting applications" (data model §7).
function accepting(e: FullEvent, now: Date) {
  return (
    (e.status === 'open_to_vendors' || e.status === 'announced') &&
    e.applicationsOpen &&
    e.moderationState === 'visible' &&
    (e.applicationsCloseAt === null || e.applicationsCloseAt > now)
  );
}

// Each slot's price, its own or the default.
function prices(e: FullEvent) {
  const fallback = e.defaultSlotPrice === null ? null : Number(e.defaultSlotPrice);
  return e.slots.flatMap((s) => (s.price === null ? (fallback ?? []) : Number(s.price)));
}

// Accepted categories with their limit and spots left: the limit minus
// approved applications in that category (data model §7).
function spots(e: FullEvent, approved = new Map<string, number>()) {
  return e.categories
    .sort((a, b) => a.category.sortOrder - b.category.sortOrder)
    .map((c) => ({ id: c.categoryId, name: c.category.name, max: c.maxVendors, left: spotsLeft(c.maxVendors, approved.get(c.categoryId) ?? 0) }));
}

// "This weekend" is the coming Saturday and Sunday (this one, on a weekend);
// "Next 30 days" is events starting within 30 days. An event matches when any
// of its days does.
function dateFilter(when: string | undefined, now: Date): Prisma.EventWhereInput {
  if (when === '30d') return { startsAt: { lte: new Date(now.getTime() + 30 * 86_400_000) } };
  if (when !== 'weekend') return {};
  const today = manilaParts(now).date;
  const day = new Date(`${today}T00:00:00Z`).getUTCDay();
  const toSaturday = day === 0 ? -1 : 6 - day;
  const saturday = new Date(Date.parse(`${today}T00:00:00+08:00`) + toSaturday * 86_400_000);
  const mondayStart = new Date(saturday.getTime() + 2 * 86_400_000);
  return { startsAt: { lt: mondayStart }, endsAt: { gte: saturday } };
}
