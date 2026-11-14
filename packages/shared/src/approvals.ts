import { z } from 'zod';
import { approvalStatusSchema, roleTypeSchema } from './accounts.js';

// Organizer approval, admin side (spec §2.1, flow 11).

// The review target (spec §2.1), as a number and in words.
export const REVIEW_TARGET_DAYS = 2;
export const REVIEW_TARGET_TEXT = '1 to 2 business days';

// How long a request has waited, worked out by the API.
const waitingSchema = z.object({
  businessDaysWaiting: z.number().int(),
  // Business days past the target, 0 when within it.
  daysOverTarget: z.number().int(),
});

export const approvalQueueItemSchema = z.object({
  userId: z.uuid(),
  displayName: z.string(),
  city: z.string().nullable(),
  linksCount: z.number().int(),
  submittedAt: z.string(),
  // Reviewed before: this is a resubmission after a rejection.
  resubmission: z.boolean(),
}).merge(waitingSchema);
export type ApprovalQueueItem = z.infer<typeof approvalQueueItemSchema>;

export const approvalQueueSchema = z.object({ items: z.array(approvalQueueItemSchema) });

export const approvalDetailSchema = z.object({
  userId: z.uuid(),
  displayName: z.string(),
  slug: z.string().nullable(),
  city: z.string().nullable(),
  about: z.string().nullable(),
  logoUrl: z.string().nullable(),
  socialLinks: z.array(z.string()),
  fullName: z.string(),
  loginEmail: z.string(),
  contactEmail: z.string().nullable(),
  phone: z.string().nullable(),
  accountCreatedAt: z.string(),
  roles: z.array(roleTypeSchema),
  status: approvalStatusSchema,
  submittedAt: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  adminNotes: z.string().nullable(),
  // Where this request sits in the queue, oldest first.
  queue: z.object({ position: z.number().int().nullable(), total: z.number().int(), nextUserId: z.uuid().nullable() }),
}).merge(waitingSchema);
export type ApprovalDetail = z.infer<typeof approvalDetailSchema>;

const noteSchema = z
  .string()
  .trim()
  .max(2000)
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

// The name and links the admin was looking at. A decision is refused if the
// organizer changed them since, so an approval always covers what was seen.
const seenSchema = z.object({ displayName: z.string(), socialLinks: z.array(z.string()) });

export const approveSchema = z.object({ note: noteSchema, seen: seenSchema });
export type ApproveInput = z.input<typeof approveSchema>;

export const rejectSchema = z.object({
  reason: z.string().trim().min(1, 'Tell the organizer what to fix').max(1000),
  note: noteSchema,
  seen: seenSchema,
});
export type RejectInput = z.input<typeof rejectSchema>;
