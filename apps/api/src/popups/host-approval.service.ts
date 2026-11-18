import { ForbiddenException, Injectable } from '@nestjs/common';
import type { HostApproval } from '@creavent/shared';
import { assertApprovalChange, changeApprovalStatus, lockVendor } from '../approvals/approval-status.js';
import type { UserRole } from '../generated/prisma/client.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { PublicRefreshService } from '../public/public-refresh.service.js';
import { tags } from '../public/tags.js';

type Db = Tx | PrismaService;

// Pop-up host approval for the vendor (spec §4.7, flow 12): once per vendor,
// reviewed by an admin from their social links, or earned by selling at a
// completed event. The admin side is in approvals.service.ts.
@Injectable()
export class HostApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refresh: PublicRefreshService,
  ) {}

  async state(userId: string, options: { justEarned?: boolean } = {}): Promise<HostApproval> {
    const role = await vendorRole(this.prisma, userId);
    const profile = await this.prisma.vendorProfile.findUnique({ where: { userId }, select: { socialLinks: true } });
    return toHostApproval(role, (profile?.socialLinks ?? []) as string[], options.justEarned ?? false);
  }

  // The earned route, checked when the vendor opens Host a pop-up: a reserved
  // slot at a completed event that was never hidden, and no revoke ever. No
  // admin decided, so there is no review, no email, and no audit row. The
  // links on the profile now count as reviewed. True when it approved just now.
  async earnIfEligible(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockVendor(tx, userId);
      const role = await vendorRole(tx, userId);
      if (role.approvalStatus === 'approved' || role.hostRevokedAt || role.suspendedAt) return false;
      const profile = await tx.vendorProfile.findUnique({ where: { userId } });
      if (!profile) return false;
      const sold = await tx.slotAssignment.findFirst({
        where: { vendorProfileId: profile.id, status: 'reserved', event: { status: 'completed', moderationState: 'visible' } },
        select: { id: true },
      });
      if (!sold) return false;
      await tx.userRole.update({
        where: { id: role.id },
        data: { approvalStatus: 'approved', approvalSource: 'earned', reviewedAt: new Date(), reviewedLinks: profile.socialLinks ?? [], rejectionReason: null },
      });
      return true;
    });
  }

  // Submit for review (spec §4.7): at least one link, saved as the vendor
  // page's social links, then pending review.
  async submit(userId: string, socialLinks: string[]) {
    const profileId = await this.prisma.$transaction(async (tx) => {
      await lockVendor(tx, userId);
      const role = await vendorRole(tx, userId);
      if (role.suspendedAt) throw new ForbiddenException('Your vendor role is suspended');
      assertApprovalChange(role.approvalStatus ?? 'not_submitted', 'submit', 'host');
      const profile = await tx.vendorProfile.findUnique({ where: { userId } });
      if (!profile) throw new ForbiddenException('Finish your shop profile first');
      await tx.vendorProfile.update({ where: { id: profile.id }, data: { socialLinks } });
      await changeApprovalStatus(tx, {
        roleId: role.id,
        from: role.approvalStatus ?? 'not_submitted',
        action: 'submit',
        subject: 'host',
        actorUserId: userId,
        data: { approvalSubmittedAt: new Date(), rejectionReason: null },
      });
      return profile.id;
    });
    // The links show on the vendor page.
    void this.refresh.refresh([tags.vendor(profileId)]);
    return this.state(userId);
  }
}

export async function vendorRole(db: Db, userId: string) {
  const role = await db.userRole.findUnique({ where: { userId_role: { userId, role: 'vendor' } } });
  if (!role) throw new ForbiddenException('Add the vendor role first');
  return role;
}

// "Approved by Creavent" on a pop-up: host approval, and the vendor role not
// suspended (data model §7).
export function isApprovedHost(role: Pick<UserRole, 'approvalStatus' | 'suspendedAt'>) {
  return role.approvalStatus === 'approved' && role.suspendedAt === null;
}

export function toHostApproval(role: UserRole, socialLinks: string[], justEarned = false): HostApproval {
  const status = role.approvalStatus ?? 'not_submitted';
  return {
    status,
    source: status === 'approved' ? role.approvalSource : null,
    submittedAt: role.approvalSubmittedAt?.toISOString() ?? null,
    decidedAt: role.reviewedAt?.toISOString() ?? null,
    rejectionReason: status === 'rejected' ? role.rejectionReason : null,
    // The revoke sets both times at once; a later rejection moves reviewedAt.
    revoked: status === 'rejected' && role.hostRevokedAt !== null && role.reviewedAt !== null && role.reviewedAt <= role.hostRevokedAt,
    suspended: role.suspendedAt !== null,
    socialLinks,
    reviewedLinks: (role.reviewedLinks ?? []) as string[],
    justEarned,
  };
}
