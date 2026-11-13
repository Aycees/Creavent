import { ConflictException } from '@nestjs/common';
import type { ApprovalStatus } from '../generated/prisma/client.js';

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
