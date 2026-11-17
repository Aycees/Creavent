import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { RoleType } from '@creavent/shared';
import { writeAuditLog } from '../audit/audit-log.js';
import { changeApprovalStatus } from '../approvals/approval-status.js';
import { appConfig } from '../config.js';
import { OutboxService } from '../notifications/outbox.service.js';
import type { Tx } from '../prisma/prisma.service.js';
import { tags } from '../public/tags.js';

// The admin's moderation actions (spec §2): hide or show an event, suspend or
// reinstate one role. Each runs in the caller's transaction, writes the audit
// log, and returns the public page tags to refresh after commit.
@Injectable()
export class ModerationService {
  constructor(private readonly outbox: OutboxService) {}

  // Emails the organizer, or a pop-up's host, unless `notify` is false: a
  // pop-up hidden by a suspension or a revoked host approval sends no email
  // of its own (spec §8.1).
  async hideEvent(tx: Tx, adminId: string, eventId: string, reason: string, options: { notify?: boolean } = {}): Promise<string[]> {
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId}::uuid FOR UPDATE`;
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: {
        organizerProfile: { include: { user: true } },
        hostVendorProfile: { include: { user: true } },
        assignments: { select: { vendorProfileId: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.moderationState === 'hidden') throw new ConflictException('This event is already hidden');
    await tx.event.update({
      where: { id: eventId },
      data: { moderationState: 'hidden', moderatedAt: new Date(), moderatedById: adminId, moderationReason: reason },
    });
    await writeAuditLog(tx, {
      actorUserId: adminId,
      action: 'event.hide',
      entityType: 'event',
      entityId: eventId,
      changes: { moderationState: { from: 'visible', to: 'hidden' } },
      reason,
    });
    const host = (event.organizerProfile ?? event.hostVendorProfile)!.user;
    const config = appConfig();
    if (options.notify !== false) {
      await this.outbox.queue(tx, {
        userId: host.id,
        toEmail: host.email,
        type: 'event_hidden',
        relatedEntityType: 'event',
        relatedEntityId: eventId,
        payload: {
          name: host.fullName,
          eventName: event.name,
          reason,
          url: event.hostVendorProfileId ? `${config.webUrl}/vendor/popups/${eventId}` : `${config.webUrl}/organizer/events/${eventId}`,
          supportEmail: config.supportEmail,
        },
      });
    }
    return [...tags.forEvent(event), tags.listing];
  }

  async showEvent(tx: Tx, adminId: string, eventId: string): Promise<string[]> {
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId}::uuid FOR UPDATE`;
    const event = await tx.event.findUnique({ where: { id: eventId }, include: { assignments: { select: { vendorProfileId: true } } } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.moderationState === 'visible') throw new ConflictException("This event isn't hidden");
    await tx.event.update({
      where: { id: eventId },
      data: { moderationState: 'visible', moderatedAt: new Date(), moderatedById: adminId, moderationReason: null },
    });
    await writeAuditLog(tx, {
      actorUserId: adminId,
      action: 'event.show',
      entityType: 'event',
      entityId: eventId,
      changes: { moderationState: { from: 'hidden', to: 'visible' } },
    });
    return [...tags.forEvent(event), tags.listing];
  }

  // The user's other role keeps working (spec §2.1). Suspending an organizer
  // can also hide their upcoming events with the same reason (decided
  // 2026-11-17).
  async suspendRole(
    tx: Tx,
    adminId: string,
    userId: string,
    role: RoleType,
    reason: string,
    options: { hideUpcomingEvents?: boolean } = {},
  ): Promise<string[]> {
    await tx.$queryRaw`SELECT id FROM user_roles WHERE user_id = ${userId}::uuid AND role = ${role}::role_type FOR UPDATE`;
    const found = await tx.userRole.findUnique({
      where: { userId_role: { userId, role } },
      include: { user: { include: { organizerProfile: true, vendorProfile: true } } },
    });
    if (!found) throw new NotFoundException(`This user has no ${role} role`);
    if (found.suspendedAt) throw new ConflictException(`This ${role} role is already suspended`);
    await tx.userRole.update({
      where: { id: found.id },
      data: { suspendedAt: new Date(), suspendedById: adminId, suspensionReason: reason },
    });
    await writeAuditLog(tx, {
      actorUserId: adminId,
      action: 'user_role.suspend',
      entityType: 'user_role',
      entityId: found.id,
      changes: { role, suspended: { from: false, to: true } },
      reason,
    });
    const refresh = [tags.listing];
    if (role === 'vendor' && found.user.vendorProfile) {
      const profileId = found.user.vendorProfile.id;
      refresh.push(...(await vendorPageTags(tx, profileId)));
      // No other vendor depends on a pop-up, so it is hidden with the
      // suspension (spec §4.7). The vendor sees the reason in the app.
      for (const event of await announcedPopups(tx, profileId)) refresh.push(...(await this.hideEvent(tx, adminId, event.id, reason, { notify: false })));
    }
    if (role === 'organizer' && found.user.organizerProfile) {
      const profileId = found.user.organizerProfile.id;
      refresh.push(tags.organizer(profileId));
      if (options.hideUpcomingEvents) {
        for (const event of await upcomingEvents(tx, profileId)) refresh.push(...(await this.hideEvent(tx, adminId, event.id, reason)));
      }
    }
    return refresh;
  }

  // Revoke a vendor's pop-up host approval (spec §4.7): back to rejected with
  // the reason, the earned route off for good, and their announced pop-ups
  // hidden with the same reason. They keep selling at other events.
  async revokeHost(tx: Tx, adminId: string, userId: string, reason: string): Promise<string[]> {
    await tx.$queryRaw`SELECT id FROM user_roles WHERE user_id = ${userId}::uuid AND role = 'vendor' FOR UPDATE`;
    const found = await tx.userRole.findUnique({
      where: { userId_role: { userId, role: 'vendor' } },
      include: { user: { include: { vendorProfile: true } } },
    });
    if (!found) throw new NotFoundException('This user has no vendor role');
    const now = new Date();
    await changeApprovalStatus(tx, {
      roleId: found.id,
      from: found.approvalStatus,
      action: 'revoke',
      subject: 'host',
      actorUserId: adminId,
      reason,
      data: { rejectionReason: reason, hostRevokedAt: now, approvalSource: null, reviewedBy: { connect: { id: adminId } }, reviewedAt: now },
    });
    const config = appConfig();
    await this.outbox.queue(tx, {
      userId,
      toEmail: found.user.email,
      type: 'host_approval_revoked',
      relatedEntityType: 'user_role',
      relatedEntityId: found.id,
      payload: { name: found.user.fullName, reason, url: `${config.webUrl}/vendor/host-approval`, supportEmail: config.supportEmail },
    });
    const refresh = [tags.listing];
    if (found.user.vendorProfile) {
      const profileId = found.user.vendorProfile.id;
      refresh.push(tags.vendor(profileId));
      for (const event of await announcedPopups(tx, profileId)) refresh.push(...(await this.hideEvent(tx, adminId, event.id, reason, { notify: false })));
    }
    return refresh;
  }

  async reinstateRole(tx: Tx, adminId: string, userId: string, role: RoleType): Promise<string[]> {
    await tx.$queryRaw`SELECT id FROM user_roles WHERE user_id = ${userId}::uuid AND role = ${role}::role_type FOR UPDATE`;
    const found = await tx.userRole.findUnique({
      where: { userId_role: { userId, role } },
      include: { user: { include: { organizerProfile: true, vendorProfile: true } } },
    });
    if (!found) throw new NotFoundException(`This user has no ${role} role`);
    if (!found.suspendedAt) throw new ConflictException(`This ${role} role isn't suspended`);
    await tx.userRole.update({ where: { id: found.id }, data: { suspendedAt: null, suspendedById: null, suspensionReason: null } });
    await writeAuditLog(tx, {
      actorUserId: adminId,
      action: 'user_role.reinstate',
      entityType: 'user_role',
      entityId: found.id,
      changes: { role, suspended: { from: true, to: false } },
    });
    const refresh = [tags.listing];
    if (role === 'vendor' && found.user.vendorProfile) refresh.push(...(await vendorPageTags(tx, found.user.vendorProfile.id)));
    if (found.user.organizerProfile) refresh.push(tags.organizer(found.user.organizerProfile.id));
    return refresh;
  }
}

// A vendor's page and the event pages that list them (reserved slots), which
// link to it.
async function vendorPageTags(tx: Tx, vendorProfileId: string) {
  const events = await tx.slotAssignment.findMany({ where: { vendorProfileId, status: 'reserved' }, select: { eventId: true }, distinct: ['eventId'] });
  return [tags.vendor(vendorProfileId), ...events.map((e) => tags.event(e.eventId))];
}

// A host's visible announced pop-ups, which a suspension or a revoke hides.
function announcedPopups(tx: Tx, vendorProfileId: string) {
  return tx.event.findMany({ where: { hostVendorProfileId: vendorProfileId, status: 'announced', moderationState: 'visible' }, select: { id: true } });
}

// An organizer's live events: open to vendors or announced, visible, and not
// ended. Drafts aren't public, so suspending leaves them alone.
export function upcomingEvents(tx: Pick<Tx, 'event'>, organizerProfileId: string) {
  return tx.event.findMany({
    where: {
      organizerProfileId,
      moderationState: 'visible',
      status: { in: ['open_to_vendors', 'announced'] },
      OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
    },
    select: { id: true, name: true },
    orderBy: { startsAt: 'asc' },
  });
}
