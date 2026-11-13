import { ConflictException } from '@nestjs/common';
import type { ApprovalStatus } from '../generated/prisma/client.js';
import type { Tx } from '../prisma/prisma.service.js';

// The allowed organizer approval changes (spec §2.1, architecture §3.5).
// A rejected organizer can resubmit; an approved one stays approved.
const allowed: Record<ApprovalStatus, ApprovalStatus[]> = {
  not_submitted: ['pending_review'],
  pending_review: ['approved', 'rejected'],
  rejected: ['pending_review'],
  approved: [],
};

export function assertApprovalChange(from: ApprovalStatus | null, to: ApprovalStatus) {
  if (!from || !allowed[from].includes(to)) {
    throw new ConflictException(
      from === 'pending_review'
        ? 'This request is already waiting for review'
        : from === 'approved'
          ? 'This organizer is already approved'
          : 'This request is not waiting for review',
    );
  }
}

// An approved organizer who changes their name, or adds a link the admin
// didn't review, goes back to review (open question D9, decided 2026-11-13).
// Removing a link, or changing anything else, keeps the approval.
export function needsReReview(
  status: ApprovalStatus | null,
  before: { displayName: string; reviewedLinks: string[] },
  after: { displayName: string; socialLinks: string[] },
) {
  if (status !== 'approved') return false;
  if (before.displayName !== after.displayName) return true;
  return after.socialLinks.some((link) => !before.reviewedLinks.includes(link));
}

// Locks an organizer's role and profile rows for the rest of the
// transaction, always in this order. The admin's decision and the organizer's
// profile edit both take these locks first, so they run one after the other
// and each sees the other's result.
export async function lockOrganizer(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT id FROM user_roles WHERE user_id = ${userId}::uuid AND role = 'organizer' FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM organizer_profiles WHERE user_id = ${userId}::uuid FOR UPDATE`;
}
