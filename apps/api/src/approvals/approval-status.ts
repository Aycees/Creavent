import { ConflictException } from '@nestjs/common';
import { writeAuditLog } from '../audit/audit-log.js';
import type { ApprovalStatus, Prisma } from '../generated/prisma/client.js';
import type { Tx } from '../prisma/prisma.service.js';

// The approval changes (spec §2.1, §4.7, architecture §3.5): what each action
// needs the status to be, and what it changes it to. Organizer approval and
// pop-up host approval follow the same rules. A rejected organizer or host
// can resubmit; an approved one goes back to review only through a re-review
// (open question D9). Revoking is for host approval only. An earned host
// approval is no admin decision, so it doesn't go through here (spec §4.7).
export type ApprovalAction = 'submit' | 're_review' | 'approve' | 'reject' | 'revoke';

// Organizer approval on the organizer row, pop-up host approval on the
// vendor row. Each is logged under its own name.
export type ApprovalSubject = 'organizer' | 'host';

const actions: Record<ApprovalAction, { from: ApprovalStatus[]; to: ApprovalStatus }> = {
  submit: { from: ['not_submitted', 'rejected'], to: 'pending_review' },
  re_review: { from: ['approved'], to: 'pending_review' },
  approve: { from: ['pending_review'], to: 'approved' },
  reject: { from: ['pending_review'], to: 'rejected' },
  revoke: { from: ['approved'], to: 'rejected' },
};

// Why an action was refused, by the status it found.
const refusals: Record<ApprovalSubject, Record<ApprovalStatus, string>> = {
  organizer: {
    pending_review: 'This request is already waiting for review',
    approved: 'This organizer is already approved',
    not_submitted: 'This request is not waiting for review',
    rejected: 'This request is not waiting for review',
  },
  host: {
    pending_review: 'This request is already waiting for review',
    approved: 'Already approved to host pop-ups',
    not_submitted: 'Not approved to host pop-ups, or not waiting for review',
    rejected: 'Not approved to host pop-ups, or not waiting for review',
  },
};

export function assertApprovalChange(from: ApprovalStatus | null, action: ApprovalAction, subject: ApprovalSubject = 'organizer') {
  if (!from || !actions[action].from.includes(from)) {
    throw new ConflictException(refusals[subject][from ?? 'not_submitted']);
  }
}

// The one way an approval status changes: checks the rule, writes the new
// status with the action's other fields, and records it in the audit log, in
// the caller's transaction.
export async function changeApprovalStatus(
  tx: Tx,
  input: {
    roleId: string;
    from: ApprovalStatus | null;
    action: ApprovalAction;
    subject?: ApprovalSubject;
    actorUserId: string;
    data?: Prisma.UserRoleUpdateInput;
    reason?: string | null;
  },
) {
  const subject = input.subject ?? 'organizer';
  assertApprovalChange(input.from, input.action, subject);
  const to = actions[input.action].to;
  await tx.userRole.update({ where: { id: input.roleId }, data: { ...input.data, approvalStatus: to } });
  await writeAuditLog(tx, {
    actorUserId: input.actorUserId,
    action: `${subject === 'host' ? 'host_approval' : 'organizer_approval'}.${input.action}`,
    entityType: 'user_role',
    entityId: input.roleId,
    changes: { approvalStatus: { from: input.from, to } },
    reason: input.reason ?? null,
  });
}

// The fields an admin reviews: the name and the links.
export type ReviewedFields = { displayName: string; socialLinks: string[] };

export function sameLinks(a: unknown, b: unknown) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

// An approved organizer who changes their name, or adds a link the admin
// didn't review, goes back to review (open question D9, decided 2026-11-13).
// Removing a link, or changing anything else, keeps the approval.
export function needsReReview(
  status: ApprovalStatus | null,
  before: { displayName: string; reviewedLinks: string[] },
  after: ReviewedFields,
) {
  if (status !== 'approved') return false;
  if (before.displayName !== after.displayName) return true;
  return after.socialLinks.some((link) => !before.reviewedLinks.includes(link));
}

// A host who changes their shop name, or adds a social link the admin didn't
// review, goes back to review, like an organizer (spec §4.7).
export function hostNeedsReReview(
  status: ApprovalStatus | null,
  before: { shopName: string; reviewedLinks: string[] },
  after: { shopName: string; socialLinks: string[] },
) {
  return needsReReview(status, { displayName: before.shopName, reviewedLinks: before.reviewedLinks }, { displayName: after.shopName, socialLinks: after.socialLinks });
}

// Locks a vendor's role and profile rows, like lockOrganizer: host approval
// decisions and profile edits run one after the other.
export async function lockVendor(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT id FROM user_roles WHERE user_id = ${userId}::uuid AND role = 'vendor' FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM vendor_profiles WHERE user_id = ${userId}::uuid FOR UPDATE`;
}

// Locks an organizer's role and profile rows for the rest of the
// transaction, always in this order. The admin's decision and the organizer's
// profile edit both take these locks first, so they run one after the other
// and each sees the other's result.
export async function lockOrganizer(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT id FROM user_roles WHERE user_id = ${userId}::uuid AND role = 'organizer' FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM organizer_profiles WHERE user_id = ${userId}::uuid FOR UPDATE`;
}
