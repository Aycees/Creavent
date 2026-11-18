import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  manilaInstant,
  manilaParts,
  type createPopupSchema,
  type Popup,
  type PopupChecklist,
  type popupDetailsSchema,
  type PopupLock,
  type PopupRow,
  type Popups,
  type PopupSummary,
} from '@creavent/shared';
import type { z } from 'zod';
import { vendorProfile } from '../applications/vendor-profile.js';
import { writeAuditLog } from '../audit/audit-log.js';
import { changeEventStatus } from '../events/event-status.js';
import { assertNotOnOtherEvent } from '../events/organizer-events.service.js';
import { assertAttachable, FilesService, retireFiles } from '../files/files.service.js';
import type { Event, UserRole } from '../generated/prisma/client.js';
import { freeSlug } from '../onboarding/slugs.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { PublicRefreshService } from '../public/public-refresh.service.js';
import { tags } from '../public/tags.js';
import { HostApprovalService, isApprovedHost, toHostApproval, vendorRole } from './host-approval.service.js';

const steps: { key: keyof PopupChecklist; label: string; next: string }[] = [
  { key: 'about', label: 'a name and description', next: 'Add a description' },
  { key: 'cover', label: 'a cover image', next: 'Add a cover' },
  { key: 'schedule', label: 'the dates and hours', next: 'Set the dates and hours' },
  { key: 'venue', label: 'the venue name, address and city', next: 'Add the venue' },
  { key: 'profile', label: 'your shop name, mobile number and a category', next: 'Finish your shop profile' },
];

// A vendor's own pop-ups (spec §4.7, flow 12, sitemap pop-up pages). Every
// change answers with the whole pop-up, like event setup.
@Injectable()
export class PopupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly hostApproval: HostApprovalService,
    private readonly refresh: PublicRefreshService,
  ) {}

  // My pop-ups: Upcoming (not ended, or no dates yet) and Past. Opening it
  // checks the earned route first (sitemap, pop-up pages).
  async list(userId: string): Promise<Popups> {
    await vendorProfile(this.prisma, userId, { read: true });
    const justEarned = await this.hostApproval.earnIfEligible(userId);
    const { host, upcoming, past } = await this.rows(userId, justEarned);
    return { host, upcoming, past };
  }

  // "Your pop-ups" on the vendor dashboard. The earned route is checked only
  // from Host a pop-up, so the page can say so (spec §4.7).
  async summary(userId: string): Promise<PopupSummary> {
    const { host, upcoming, past } = await this.rows(userId, false);
    return { host, upcoming: upcoming.slice(0, 2), total: upcoming.length + past.length };
  }

  private async rows(userId: string, justEarned: boolean) {
    const profile = await vendorProfile(this.prisma, userId, { read: true });
    const [host, role, events] = await Promise.all([
      this.hostApproval.state(userId, { justEarned }),
      vendorRole(this.prisma, userId),
      this.prisma.event.findMany({
        where: { hostVendorProfileId: profile.id },
        orderBy: [{ startsAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      }),
    ]);
    const startOfToday = new Date(`${manilaParts(new Date()).date}T00:00:00+08:00`);
    const profileReady = await this.profileReady(userId);
    const rows = events.map((e) => ({ row: this.row(e, role, profileReady), ended: e.endsAt !== null && e.endsAt < startOfToday }));
    return {
      host,
      upcoming: rows.filter((r) => !r.ended).map((r) => r.row),
      past: rows
        .filter((r) => r.ended)
        .reverse()
        .map((r) => r.row),
    };
  }

  async create(userId: string, input: z.output<typeof createPopupSchema>) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await vendorProfile(tx, userId);
      const type = await tx.eventType.findFirstOrThrow({ where: { hostKind: 'vendor' } });
      const event = await tx.event.create({
        data: { hostVendorProfileId: profile.id, eventTypeId: type.id, name: input.name, slug: await freeSlug(tx, 'event', input.name, userId) },
      });
      return { id: event.id };
    });
  }

  async get(userId: string, id: string): Promise<Popup> {
    const profile = await vendorProfile(this.prisma, userId, { read: true });
    const event = await this.prisma.event.findFirst({ where: { id, hostVendorProfileId: profile.id }, include: { coverFile: true } });
    if (!event) throw new NotFoundException('Pop-up not found');
    const role = await vendorRole(this.prisma, userId);
    const categories = await this.prisma.vendorProfileCategory.findMany({
      where: { vendorProfileId: profile.id },
      include: { category: true },
      orderBy: { category: { sortOrder: 'asc' } },
    });
    const start = event.startsAt ? manilaParts(event.startsAt) : null;
    const end = event.endsAt ? manilaParts(event.endsAt) : null;
    return {
      id: event.id,
      slug: event.slug,
      status: event.status,
      details: {
        name: event.name,
        description: event.description,
        startDate: start?.date ?? null,
        endDate: end?.date ?? null,
        opensAt: start?.time ?? null,
        closesAt: end?.time ?? null,
        venueName: event.venueName,
        addressLine: event.addressLine,
        city: event.city,
        cover: event.coverFile ? { id: event.coverFile.id, url: this.files.url(event.coverFile.storageKey) } : null,
      },
      shop: { shopName: profile.shopName, categories: categories.map((c) => c.category.name) },
      checklist: checklist(event, role, await this.profileReady(userId)),
      host: toHostApproval(role, (profile.socialLinks ?? []) as string[]),
      lock: lockOf(event, role),
      hiddenByCreavent: event.moderationState === 'hidden' ? { reason: event.moderationReason } : null,
      canceled: event.canceledAt ? { at: event.canceledAt.toISOString(), reason: event.cancelReason } : null,
      ended: event.endsAt !== null && event.endsAt <= new Date(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  async update(userId: string, id: string, input: z.output<typeof popupDetailsSchema>) {
    const announced = await this.prisma.$transaction(async (tx) => {
      const { event, role } = await this.own(tx, userId, id);
      assertEditable(event, role);
      if (input.coverFileId && input.coverFileId !== event.coverFileId) {
        await assertAttachable(tx, input.coverFileId, userId, 'event_cover');
        await assertNotOnOtherEvent(tx, input.coverFileId, event.id);
      }
      await retireFiles(tx, [event.coverFileId], [input.coverFileId]);
      const scheduled = input.startDate && input.endDate && input.opensAt && input.closesAt;
      await tx.event.update({
        where: { id: event.id },
        data: {
          name: input.name,
          description: input.description,
          startsAt: scheduled ? manilaInstant(input.startDate!, input.opensAt!) : null,
          endsAt: scheduled ? manilaInstant(input.endDate!, input.closesAt!) : null,
          venueName: input.venueName,
          addressLine: input.addressLine,
          city: input.city,
          coverFileId: input.coverFileId,
        },
      });
      // The page shows "Details updated" with the date. Nobody is emailed:
      // attendees have no accounts (spec §4.7).
      return event.status === 'announced';
    });
    if (announced) void this.refresh.refresh([tags.listing, tags.event(id)]);
    return this.get(userId, id);
  }

  // Announce (spec §4.7): from a draft, before it ends, not hidden, with
  // every step done and an approved host.
  async announce(userId: string, id: string) {
    const vendorProfileId = await this.prisma.$transaction(async (tx) => {
      const { event, role } = await this.own(tx, userId, id);
      if (!isApprovedHost(role)) throw new ForbiddenException('Get approved to host pop-ups to announce this one');
      if (event.moderationState === 'hidden') throw new ConflictException("This pop-up is hidden by Creavent, so it can't be announced");
      if (event.status === 'draft') {
        const list = checklist(event, role, await this.profileReady(userId, tx));
        const missing = steps.filter((s) => !list[s.key]).map((s) => s.label);
        if (missing.length) throw new ConflictException(`Add ${missing.join(', ')} first`);
        if (event.endsAt! <= new Date()) throw new ConflictException("This pop-up has ended, so it can't be announced");
      }
      await changeEventStatus(tx, { eventId: event.id, from: event.status, action: 'announce_popup', actorUserId: userId, data: { announcedAt: new Date() } });
      return event.hostVendorProfileId!;
    });
    void this.refresh.refresh([tags.listing, tags.event(id), tags.vendor(vendorProfileId)]);
    return this.get(userId, id);
  }

  // Cancel (spec §4.7): the page stays up marked canceled, with the reason as
  // the host's note. No email, since there are no other vendors.
  async cancel(userId: string, id: string, reason: string | null) {
    const vendorProfileId = await this.prisma.$transaction(async (tx) => {
      const { event } = await this.own(tx, userId, id);
      if (event.status !== 'announced') throw new ConflictException('Only an announced pop-up can be canceled. Delete a draft instead.');
      await changeEventStatus(tx, { eventId: event.id, from: event.status, action: 'cancel', actorUserId: userId, data: { canceledAt: new Date(), cancelReason: reason }, reason });
      return event.hostVendorProfileId!;
    });
    void this.refresh.refresh([tags.listing, tags.event(id), tags.vendor(vendorProfileId)]);
    return this.get(userId, id);
  }

  // A draft was never public, so it is deleted for good (spec §4.7).
  async deleteDraft(userId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const { event } = await this.own(tx, userId, id);
      if (event.status !== 'draft') throw new ConflictException('Only drafts can be deleted. Cancel this pop-up instead.');
      await tx.event.delete({ where: { id: event.id } });
      await retireFiles(tx, [event.coverFileId], []);
      await writeAuditLog(tx, { actorUserId: userId, action: 'event.delete_draft', entityType: 'event', entityId: event.id, changes: { name: event.name, slug: event.slug } });
    });
  }

  // Duplicate (spec §4.7): a new draft with the same name, description,
  // cover, and venue, and no dates or hours. The cover is copied as a new
  // file. This is how a weekly pop-up is posted again.
  async duplicate(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await vendorProfile(tx, userId);
      const source = await tx.event.findFirst({ where: { id, hostVendorProfileId: profile.id } });
      if (!source) throw new NotFoundException('Pop-up not found');
      const coverFileId = source.coverFileId ? await this.files.copyPublicImage(tx, source.coverFileId, userId) : null;
      const type = await tx.eventType.findFirstOrThrow({ where: { hostKind: 'vendor' } });
      const copy = await tx.event.create({
        data: {
          hostVendorProfileId: profile.id,
          eventTypeId: type.id,
          name: source.name,
          slug: await freeSlug(tx, 'event', source.name, userId),
          description: source.description,
          coverFileId,
          venueName: source.venueName,
          addressLine: source.addressLine,
          city: source.city,
          province: source.province,
        },
      });
      return { id: copy.id };
    });
  }

  // The host's own pop-up, locked for the rest of the transaction, or Not
  // found for anyone else. Refused while the vendor role is suspended, and
  // nothing changes on a canceled or hidden one (spec §2, §4.7). Cancel
  // stays possible while host approval is back in review.
  private async own(tx: Tx, userId: string, id: string) {
    const profile = await vendorProfile(tx, userId);
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${id}::uuid FOR UPDATE`;
    const event = await tx.event.findFirst({ where: { id, hostVendorProfileId: profile.id } });
    if (!event) throw new NotFoundException('Pop-up not found');
    if (event.status === 'canceled') throw new ConflictException('This pop-up is canceled');
    if (event.moderationState === 'hidden') throw new ConflictException('This pop-up is hidden by Creavent');
    const role = await vendorRole(tx, userId);
    return { event, role };
  }

  // Shop name, mobile number, and at least one category (spec §1.1).
  private async profileReady(userId: string, db: Tx | PrismaService = this.prisma) {
    const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { vendorProfile: { include: { _count: { select: { categories: true } } } } } });
    return Boolean(user.phone && user.vendorProfile?.shopName && user.vendorProfile._count.categories > 0);
  }

  private row(e: Event, role: UserRole, profileReady: boolean): PopupRow {
    const start = e.startsAt ? manilaParts(e.startsAt) : null;
    const end = e.endsAt ? manilaParts(e.endsAt) : null;
    return {
      id: e.id,
      slug: e.slug,
      name: e.name,
      status: e.status,
      startDate: start?.date ?? null,
      endDate: end?.date ?? null,
      opensAt: start?.time ?? null,
      closesAt: end?.time ?? null,
      venueName: e.venueName,
      hidden: e.moderationState === 'hidden',
      nextStep: nextStep(e, role, profileReady),
    };
  }
}

function checklist(e: Event, role: UserRole, profileReady: boolean): PopupChecklist {
  return {
    about: Boolean(e.name && e.description),
    cover: e.coverFileId !== null,
    schedule: e.startsAt !== null && e.endsAt !== null,
    venue: Boolean(e.venueName && e.addressLine && e.city),
    profile: profileReady,
    host: isApprovedHost(role),
  };
}

function nextStep(e: Event, role: UserRole, profileReady: boolean) {
  if (e.moderationState === 'hidden') return 'Hidden by Creavent';
  if (e.status === 'draft') {
    const list = checklist(e, role, profileReady);
    const missing = steps.find((s) => !list[s.key]);
    if (missing) return missing.next;
    return list.host ? 'Ready to announce' : 'Get approved to announce';
  }
  return { announced: 'On the events page', completed: 'Completed', canceled: 'Canceled', open_to_vendors: '' }[e.status];
}

// Why the form can't be changed (spec §4.7): a draft can be edited any
// time, an announced pop-up only while the host is approved.
function lockOf(e: Event, role: UserRole): PopupLock {
  if (e.status === 'canceled') return 'canceled';
  if (e.moderationState === 'hidden') return 'hidden';
  if (role.suspendedAt) return 'suspended';
  if (e.status === 'completed' || (e.status !== 'draft' && e.endsAt !== null && e.endsAt <= new Date())) return 'ended';
  if (e.status === 'announced' && role.approvalStatus !== 'approved') return 'pending_review';
  return null;
}

const lockMessages: Record<NonNullable<PopupLock>, string> = {
  canceled: 'This pop-up is canceled',
  hidden: 'This pop-up is hidden by Creavent',
  suspended: 'Your vendor role is suspended',
  ended: 'This pop-up has ended',
  pending_review: "Your host approval is being reviewed again, so this pop-up can't be edited yet",
};

function assertEditable(e: Event, role: UserRole) {
  const lock = lockOf(e, role);
  if (lock) throw new ConflictException(lockMessages[lock]);
}
