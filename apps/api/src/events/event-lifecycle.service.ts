import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { formatSchedule, scheduleOf, UNDO_ANNOUNCE_MINUTES } from '@creavent/shared';
import { archivePayment } from '../applications/assignment-status.js';
import { ACTIVE, slotLabel } from '../applications/slot-status.js';
import { writeAuditLog } from '../audit/audit-log.js';
import { appConfig } from '../config.js';
import type { Event } from '../generated/prisma/client.js';
import { OutboxService } from '../notifications/outbox.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { changeEventStatus } from './event-status.js';
import { ownEvent } from './organizer-events.service.js';
import { PublicRefreshService } from '../public/public-refresh.service.js';
import { tags } from '../public/tags.js';

// Announce and cancel (spec §3.1, flows 8 and 9, decisions Q4, Q6, Q7), and
// the emails sent when an event's time or place changes (decision Q8).
@Injectable()
export class EventLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly refresh: PublicRefreshService,
  ) {}

  // Puts the event on the listing. Needs an approved organizer, like opening,
  // since the event becomes public with the "Approved by Creavent" seal.
  async announce(userId: string, eventId: string) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      const role = await tx.userRole.findUniqueOrThrow({ where: { userId_role: { userId, role: 'organizer' } } });
      if (role.approvalStatus !== 'approved' || role.suspendedAt) throw new ForbiddenException('Get approved to announce this event');
      if (event.status === 'open_to_vendors') {
        if (event.moderationState === 'hidden') throw new ConflictException("This event is hidden, so it can't be announced");
        if (!event.endsAt || event.endsAt <= new Date()) throw new ConflictException("This event has ended, so it can't be announced");
      }
      await changeEventStatus(tx, {
        eventId: event.id,
        from: event.status,
        action: 'announce',
        actorUserId: userId,
        data: { announcedAt: new Date() },
      });
    });
    void this.refresh.refresh([tags.listing, tags.event(eventId)]);
  }

  // Undoes an announcement made by mistake or too early, back to open to
  // vendors, within UNDO_ANNOUNCE_MINUTES (decision Q9). Hardly anyone has
  // seen it by then, so nothing shared breaks. Slots, payments, and
  // applications stay as they are, so vendors aren't emailed.
  async undoAnnounce(userId: string, eventId: string) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      if (event.status === 'announced' && !undoAnnounceUntil(event)) {
        throw new ConflictException(`You can undo an announcement for ${UNDO_ANNOUNCE_MINUTES} minutes. Edit or cancel the event instead.`);
      }
      await changeEventStatus(tx, {
        eventId: event.id,
        from: event.status,
        action: 'undo_announce',
        actorUserId: userId,
        // Never public until announced again (decision Q2 reads it).
        data: { announcedAt: null },
      });
    });
    void this.refresh.refresh([tags.listing, tags.event(eventId)]);
  }

  // Cancels for good. Every active assignment ends as canceled, its payment
  // records are archived for both sides, and each active vendor is emailed.
  // Applications keep their status (decision Q7).
  async cancel(userId: string, eventId: string, reason: string | null) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      const now = new Date();
      await changeEventStatus(tx, {
        eventId: event.id,
        from: event.status,
        action: 'cancel',
        actorUserId: userId,
        data: { canceledAt: now, cancelReason: reason, applicationsOpen: false },
        reason,
      });
      const assignments = await tx.slotAssignment.findMany({ where: { eventId: event.id, status: { in: [...ACTIVE] } } });
      for (const a of assignments) {
        await tx.slotAssignment.update({
          where: { id: a.id },
          data: { status: 'canceled', endedAt: now, endedById: userId, endedReason: 'Event canceled' },
        });
        await tx.slotAssignmentSlot.updateMany({ where: { slotAssignmentId: a.id }, data: { active: false } });
        await archivePayment(tx, a.id, now);
      }
      if (assignments.length) {
        await writeAuditLog(tx, {
          actorUserId: userId,
          action: 'assignment.cancel',
          entityType: 'event',
          entityId: event.id,
          changes: { assignmentIds: assignments.map((a) => a.id), status: { to: 'canceled' } },
        });
      }
      const organizer = await tx.organizerProfile.findUniqueOrThrow({ where: { id: event.organizerProfileId } });
      const config = appConfig();
      for (const v of await activeVendors(tx, event.id, assignments)) {
        await this.outbox.queue(tx, {
          userId: v.userId,
          toEmail: v.email,
          type: 'event_canceled',
          payload: {
            name: v.name,
            eventName: event.name,
            schedule: formatSchedule(scheduleOf(event)),
            place: place(event),
            slotLabel: v.slotLabel,
            reason,
            organizerName: organizer.displayName,
            organizerContact: event.vendorContactInfo,
            url: `${config.webUrl}/vendor/applications/${v.applicationId}`,
            supportEmail: config.supportEmail,
          },
          relatedEntityType: 'event',
          relatedEntityId: event.id,
        });
      }
    });
    void this.refresh.refresh([tags.listing, tags.event(eventId)]);
  }
}

// Until when the announcement can be undone, or null once it can't.
export function undoAnnounceUntil(e: { status: string; announcedAt: Date | null }, now = new Date()) {
  if (e.status !== 'announced' || !e.announcedAt) return null;
  const until = new Date(e.announcedAt.getTime() + UNDO_ANNOUNCE_MINUTES * 60_000);
  return until > now ? until : null;
}

// The schedule and place fields vendors are told about when they change.
type Watched = Pick<Event, 'startsAt' | 'endsAt' | 'venueName' | 'addressLine' | 'city'>;

function place(e: Pick<Event, 'venueName' | 'addressLine' | 'city'>) {
  return [e.venueName, e.addressLine, e.city].filter(Boolean).join(', ') || null;
}

// What changed, as "When" and "Where" lines with the old and new values.
export function eventChanges(before: Watched, after: Watched) {
  const changes: { label: string; from: string | null; to: string | null }[] = [];
  const when = [formatSchedule(scheduleOf(before)), formatSchedule(scheduleOf(after))];
  if (when[0] !== when[1]) changes.push({ label: 'When', from: when[0]!, to: when[1]! });
  const where = [place(before), place(after)];
  if (where[0] !== where[1]) changes.push({ label: 'Where', from: where[0]!, to: where[1]! });
  return changes;
}

// Emails each active vendor when the time or place of an event they can see
// changes (decision Q8). Call inside the save's transaction.
export async function queueChangeEmails(tx: Tx, outbox: OutboxService, before: Event, after: Watched & Pick<Event, 'name'>) {
  if (before.status !== 'open_to_vendors' && before.status !== 'announced') return;
  const changes = eventChanges(before, after);
  if (!changes.length) return;
  const assignments = await tx.slotAssignment.findMany({ where: { eventId: before.id, status: { in: [...ACTIVE] } } });
  const config = appConfig();
  for (const v of await activeVendors(tx, before.id, assignments)) {
    await outbox.queue(tx, {
      userId: v.userId,
      toEmail: v.email,
      type: 'event_changed',
      payload: {
        name: v.name,
        eventName: after.name,
        slotLabel: v.slotLabel,
        changes,
        url: `${config.webUrl}/vendor/applications/${v.applicationId}`,
        supportEmail: config.supportEmail,
      },
      relatedEntityType: 'event',
      relatedEntityId: before.id,
    });
  }
}

// Vendors with a submitted or approved application (decision Q6), with the
// slots of their active assignment, if any.
async function activeVendors(tx: Tx, eventId: string, assignments: { id: string; applicationId: string }[]) {
  const applications = await tx.application.findMany({
    where: { eventId, status: { in: ['submitted', 'approved'] } },
    include: { vendorProfile: { include: { user: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const slotRows = await tx.slotAssignmentSlot.findMany({
    where: { slotAssignmentId: { in: assignments.map((a) => a.id) } },
    include: { slot: true },
  });
  return applications.map((app) => {
    const assignment = assignments.find((a) => a.applicationId === app.id);
    const rows = assignment ? slotRows.filter((r) => r.slotAssignmentId === assignment.id) : [];
    const user = app.vendorProfile.user;
    return { applicationId: app.id, userId: user.id, email: user.email, name: user.fullName, slotLabel: rows.length ? slotLabel(rows) : null };
  });
}
