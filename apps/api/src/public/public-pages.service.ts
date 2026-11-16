import { Injectable, NotFoundException } from '@nestjs/common';
import { scheduleOf, type PublicEvent, type PublicEventResponse } from '@creavent/shared';
import { sortedSlots } from '../applications/slot-status.js';
import { FilesService } from '../files/files.service.js';
import type { Prisma } from '../generated/prisma/client.js';
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

  private async publicEvent(e: FullEvent): Promise<PublicEvent> {
    return {
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
      socialLinks: Array.isArray(o.socialLinks) ? (o.socialLinks as string[]) : [],
      eventsHeld: await this.prisma.event.count({ where: { organizerProfileId: o.id, status: 'completed', moderationState: 'visible' } }),
    };
  }
}

function canceled(e: { canceledAt: Date | null; cancelReason: string | null }) {
  return e.canceledAt ? { at: e.canceledAt.toISOString(), reason: e.cancelReason } : null;
}
