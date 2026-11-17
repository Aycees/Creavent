import { Injectable, NotFoundException } from '@nestjs/common';
import {
  manilaParts,
  scheduleOf,
  type Listing,
  type ListingCard,
  type ListingQuery,
  type PublicEvent,
  type PublicEventResponse,
  type PublicOrganizerPage,
  type PublicVendorPage,
} from '@creavent/shared';
import { sortedSlots } from '../applications/slot-status.js';
import { FilesService } from '../files/files.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { tags } from './tags.js';

const eventInclude = {
  eventType: true,
  coverFile: true,
  publicFloorPlanFile: true,
  organizerProfile: { include: { logoFile: true, user: { include: { roles: { where: { role: 'organizer' as const } } } } } },
  assignments: {
    where: { status: 'reserved' as const },
    include: {
      slots: { include: { slot: true } },
      application: { include: { categories: { include: { category: true } } } },
      vendorProfile: { include: { user: { include: { avatarFile: true, roles: { where: { role: 'vendor' as const } } } } } },
    },
  },
} satisfies Prisma.EventInclude;

type FullEvent = Prisma.EventGetPayload<{ include: typeof eventInclude }>;
type Organizer = FullEvent['organizerProfile'];

// The pages anyone can open without an account (spec §7, sitemap §3). The
// web app caches them under the returned tags (decision Q1).
@Injectable()
export class PublicPagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  // The event page for a visitor. Drafts and hidden events are Not found; an
  // event only open to vendors isn't public yet; one canceled before it was
  // announced shows its name and dates only (decision Q2).
  async event(slug: string): Promise<PublicEventResponse> {
    const event = await this.prisma.event.findUnique({ where: { slug }, include: eventInclude });
    if (!event || event.status === 'draft' || event.moderationState === 'hidden') throw new NotFoundException('Event not found');
    const eventTags = tags.forEvent(event);
    if (event.status === 'open_to_vendors') return { tags: eventTags, page: { view: 'not_public' } };
    if (event.status === 'canceled' && !event.announcedAt) {
      return { tags: eventTags, page: { view: 'canceled_notice', name: event.name, ...scheduleOf(event), canceled: canceled(event) } };
    }
    return { tags: eventTags, page: { view: 'public', event: await this.publicEvent(event) } };
  }

  // The public view of one event, at any status: for visitors, and for its
  // organizer, who sees it with "Manage event" (sitemap §3).
  async publicEventById(id: string) {
    const event = await this.prisma.event.findUniqueOrThrow({ where: { id }, include: eventInclude });
    return this.publicEvent(event);
  }

  // The event listing (spec §7.3): visible announced events that end today or
  // later (Manila days), soonest first, with search (decision Q5) and the
  // type, city, and date filters. Type counts use every other filter.
  async listing(query: ListingQuery, now = new Date()): Promise<Listing> {
    const today = manilaParts(now).date;
    const upcoming: Prisma.EventWhereInput = { status: 'announced', moderationState: 'visible', endsAt: { gte: manilaStart(today) } };
    const ids = query.q ? await this.search(query.q) : null;
    const range = dateRange(query, today);
    const filtered = await this.prisma.event.findMany({
      where: {
        ...upcoming,
        ...(query.city ? { city: query.city } : {}),
        ...(ids ? { id: { in: ids } } : {}),
        ...(range ? { startsAt: { lt: manilaStart(addDays(range.to, 1)) }, AND: [{ endsAt: { gte: manilaStart(range.from) } }] } : {}),
      },
      include: listingInclude,
      orderBy: [{ startsAt: 'asc' }, { name: 'asc' }],
      take: 300,
    });
    const events = query.type ? filtered.filter((e) => e.eventType.slug === query.type) : filtered;
    const [types, all, openToVendors] = await Promise.all([
      this.prisma.eventType.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.event.findMany({ where: upcoming, select: { city: true, startsAt: true, endsAt: true } }),
      this.prisma.event.count({
        where: {
          status: { in: ['open_to_vendors', 'announced'] },
          moderationState: 'visible',
          applicationsOpen: true,
          endsAt: { gt: now },
          OR: [{ applicationsCloseAt: null }, { applicationsCloseAt: { gt: now } }],
        },
      }),
    ]);
    const next7 = Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((date) => ({
      date,
      count: all.filter((e) => e.startsAt && e.endsAt && manilaParts(e.startsAt).date <= date && manilaParts(e.endsAt).date >= date).length,
    }));
    return {
      tags: [tags.listing, ...events.map((e) => tags.event(e.id))],
      today,
      events: events.map((e) => this.card(e)),
      types: types.map((t) => ({ slug: t.slug, name: t.name, count: filtered.filter((e) => e.eventTypeId === t.id).length })),
      cities: [...new Set(all.flatMap((e) => e.city ?? []))].sort((a, b) => a.localeCompare(b)),
      next7,
      openToVendors,
    };
  }

  // /organizers/[slug] (spec §7.1). Not found while the organizer role is
  // suspended or the account is deleted.
  async organizerPage(slug: string, now = new Date()): Promise<PublicOrganizerPage> {
    const o = await this.prisma.organizerProfile.findUnique({
      where: { slug },
      include: { logoFile: true, user: { include: { roles: { where: { role: 'organizer' } } } } },
    });
    const role = o?.user.roles[0];
    if (!o || !role || role.suspendedAt || o.user.deletedAt) throw new NotFoundException('Organizer not found');
    const today = manilaParts(now).date;
    const visible = { organizerProfileId: o.id, moderationState: 'visible' as const };
    const [upcoming, past] = await Promise.all([
      this.prisma.event.findMany({
        where: { ...visible, status: 'announced', endsAt: { gte: manilaStart(today) } },
        include: listingInclude,
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.event.findMany({ where: { ...visible, status: 'completed' }, include: { eventType: true }, orderBy: { startsAt: 'desc' } }),
    ]);
    return {
      tags: [tags.organizer(o.id), ...[...upcoming, ...past].map((e) => tags.event(e.id))],
      organizer: {
        id: o.id,
        displayName: o.displayName,
        slug: o.slug!,
        logoUrl: o.logoFile ? this.files.url(o.logoFile.storageKey) : null,
        approved: approved(role),
        about: o.about,
        city: o.city,
        socialLinks: links(o.socialLinks),
        joinedAt: role.createdAt.toISOString(),
        eventsHeld: past.length,
      },
      upcoming: upcoming.map((e) => this.card(e)),
      past: past.map((e) => profileEvent(e)),
    };
  }

  // /vendors/[slug] (spec §7.2, data model §7). Only events where the vendor
  // had a reserved slot and the event was announced or completed, and
  // visible. Never contact details, applications, documents, or payments.
  async vendorPage(slug: string, now = new Date()): Promise<PublicVendorPage> {
    const v = await this.prisma.vendorProfile.findUnique({
      where: { slug },
      include: {
        categories: { include: { category: true } },
        photos: { include: { file: true }, orderBy: { sortOrder: 'asc' }, take: 8 },
        user: { include: { avatarFile: true, roles: { where: { role: 'vendor' } } } },
      },
    });
    const role = v?.user.roles[0];
    if (!v || !role || role.suspendedAt || v.user.deletedAt) throw new NotFoundException('Vendor not found');
    const assignments = await this.prisma.slotAssignment.findMany({
      where: { vendorProfileId: v.id, status: 'reserved', event: { status: { in: ['announced', 'completed'] }, moderationState: 'visible' } },
      include: { slots: { include: { slot: true } }, event: { include: listingInclude } },
    });
    const startOfToday = manilaStart(manilaParts(now).date);
    const sold = assignments
      .map((a) => ({
        event: a.event,
        slotLabel: sortedSlots(a.slots)
          .map((x) => x.slot.label)
          .join(', '),
        upcoming: a.event.status === 'announced' && a.event.endsAt !== null && a.event.endsAt >= startOfToday,
      }))
      .sort((a, b) => (b.event.startsAt?.getTime() ?? 0) - (a.event.startsAt?.getTime() ?? 0));
    const next = sold.filter((s) => s.upcoming).at(-1) ?? null;
    return {
      tags: [tags.vendor(v.id), ...sold.map((s) => tags.event(s.event.id))],
      vendor: {
        id: v.id,
        shopName: v.shopName,
        slug: v.slug!,
        avatarUrl: v.user.avatarFile ? this.files.url(v.user.avatarFile.storageKey) : null,
        categories: v.categories.sort((a, b) => a.category.sortOrder - b.category.sortOrder).map((c) => c.category.name),
        description: v.description,
        products: v.products,
        city: v.city,
        socialLinks: links(v.socialLinks),
        photos: v.photos.filter((p) => !p.file.deletedAt).map((p) => this.files.url(p.file.storageKey)),
        joinedAt: role.createdAt.toISOString(),
        eventsSoldAt: sold.length,
      },
      next: next ? { event: this.card(next.event), slotLabel: next.slotLabel } : null,
      sold: sold.map((s) => ({
        ...profileEvent(s.event),
        organizerName: s.event.organizerProfile.displayName,
        slotLabel: s.slotLabel,
        upcoming: s.upcoming,
      })),
    };
  }

  private card(e: Prisma.EventGetPayload<{ include: typeof listingInclude }>): ListingCard {
    return {
      slug: e.slug,
      name: e.name,
      typeName: e.eventType.name,
      ...scheduleOf(e),
      venueName: e.venueName,
      city: e.city,
      coverUrl: e.coverFile ? this.files.url(e.coverFile.storageKey) : null,
      organizer: { displayName: e.organizerProfile.displayName, approved: approved(e.organizerProfile.user.roles[0]) },
    };
  }

  // Event ids whose name, venue, address, city, or organizer matches every
  // word of the search, each as a prefix: "vint" finds "Vintage" (decision
  // Q5). Only letters and digits reach the query, so its syntax can't break.
  private async search(q: string) {
    const words = (q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8);
    if (!words.length) return [];
    const tsquery = words.map((w) => `${w}:*`).join(' & ');
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT e.id FROM events e
      JOIN organizer_profiles o ON o.id = e.organizer_profile_id
      WHERE to_tsvector('simple', concat_ws(' ', e.name, e.venue_name, e.address_line, e.city, o.display_name))
        @@ to_tsquery('simple', ${tsquery})`);
    return rows.map((r) => r.id);
  }

  private async publicEvent(e: FullEvent): Promise<PublicEvent> {
    return {
      id: e.id,
      slug: e.slug,
      name: e.name,
      typeName: e.eventType.name,
      status: e.status,
      ...scheduleOf(e),
      venueName: e.venueName,
      addressLine: e.addressLine,
      city: e.city,
      latitude: e.latitude === null ? null : Number(e.latitude),
      longitude: e.longitude === null ? null : Number(e.longitude),
      description: e.description,
      coverUrl: e.coverFile ? this.files.url(e.coverFile.storageKey) : null,
      publicFloorPlanUrl: e.publicFloorPlanFile ? this.files.url(e.publicFloorPlanFile.storageKey) : null,
      organizer: await this.organizer(e.organizerProfile),
      // A canceled event's slots ended with it, so nobody is listed.
      vendors: e.status === 'canceled' ? [] : this.vendors(e),
      updatedAt: e.updatedAt.toISOString(),
      canceled: canceled(e),
    };
  }

  // The accepted-vendor list (data model §7), in slot list order.
  private vendors(e: FullEvent) {
    return e.assignments
      .map((a) => {
        const slots = sortedSlots(a.slots);
        const user = a.vendorProfile.user;
        const deleted = user.deletedAt !== null;
        const available = !deleted && user.roles[0]?.suspendedAt == null;
        return {
          order: slots[0]?.slot.sortOrder ?? 0,
          row: {
            shopName: deleted ? 'Deleted user' : a.vendorProfile.shopName,
            slug: available ? a.vendorProfile.slug : null,
            avatarUrl: !deleted && user.avatarFile ? this.files.url(user.avatarFile.storageKey) : null,
            categories: a.application.categories
              .sort((x, y) => x.category.sortOrder - y.category.sortOrder)
              .map((c) => c.category.name),
            slotLabel: slots.map((s) => s.slot.label).join(', '),
          },
        };
      })
      .sort((a, b) => a.order - b.order || a.row.slotLabel.localeCompare(b.row.slotLabel))
      .map((v) => v.row);
  }

  private async organizer(o: Organizer) {
    const role = o.user.roles[0];
    const pageAvailable = o.user.deletedAt === null && role?.suspendedAt == null;
    return {
      displayName: o.displayName,
      slug: pageAvailable ? o.slug : null,
      logoUrl: o.logoFile ? this.files.url(o.logoFile.storageKey) : null,
      approved: role?.approvalStatus === 'approved' && role.suspendedAt === null,
      about: o.about,
      socialLinks: links(o.socialLinks),
      eventsHeld: await this.prisma.event.count({ where: { organizerProfileId: o.id, status: 'completed', moderationState: 'visible' } }),
    };
  }
}

const listingInclude = {
  eventType: true,
  coverFile: true,
  organizerProfile: { include: { user: { include: { roles: { where: { role: 'organizer' as const } } } } } },
} satisfies Prisma.EventInclude;

// "Approved by Creavent" (data model §7).
function approved(role: { approvalStatus: string | null; suspendedAt: Date | null } | undefined) {
  return role?.approvalStatus === 'approved' && role.suspendedAt === null;
}

function links(json: Prisma.JsonValue) {
  return Array.isArray(json) ? json.filter((l): l is string => typeof l === 'string') : [];
}

function profileEvent(e: { slug: string; name: string; eventType: { name: string }; startsAt: Date | null; endsAt: Date | null; venueName: string | null }) {
  return { slug: e.slug, name: e.name, typeName: e.eventType.name, ...scheduleOf(e), venueName: e.venueName };
}

// Midnight starting a Manila date, as an instant.
const manilaStart = (date: string) => new Date(`${date}T00:00:00+08:00`);

function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

// The Manila dates a date filter covers (spec §7.3). An event matches when
// any of its days falls inside. This weekend is Saturday and Sunday: the
// coming one, or the current one on a weekend.
function dateRange(query: ListingQuery, today: string): { from: string; to: string } | null {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  switch (query.when) {
    case 'weekend': {
      const saturday = addDays(today, weekday === 0 ? -1 : 6 - weekday);
      return { from: saturday, to: addDays(saturday, 1) };
    }
    case '2weeks':
      return { from: today, to: addDays(today, 13) };
    case 'next_month': {
      const [y, m] = today.split('-').map(Number) as [number, number];
      const first = new Date(Date.UTC(y, m, 1));
      const last = new Date(Date.UTC(y, m + 1, 0));
      return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
    }
    case 'dates':
      if (!query.from) return null;
      return query.to && query.to >= query.from ? { from: query.from, to: query.to } : { from: query.from, to: query.from };
    default:
      return null;
  }
}

function canceled(e: { canceledAt: Date | null; cancelReason: string | null }) {
  return e.canceledAt ? { at: e.canceledAt.toISOString(), reason: e.cancelReason } : null;
}
