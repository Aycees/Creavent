import { z } from 'zod';
import { approvalStatusSchema, roleTypeSchema } from './accounts.js';

// Organizer approval, admin side (spec §2.1, flow 11).

export const approvalQueueItemSchema = z.object({
  userId: z.uuid(),
  displayName: z.string(),
  city: z.string().nullable(),
  linksCount: z.number().int(),
  submittedAt: z.string(),
  // Reviewed before: this is a resubmission after a rejection.
  resubmission: z.boolean(),
});
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
});
export type ApprovalDetail = z.infer<typeof approvalDetailSchema>;

const noteSchema = z
  .string()
  .trim()
  .max(2000)
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

export const approveSchema = z.object({ note: noteSchema });
export type ApproveInput = z.input<typeof approveSchema>;

export const rejectSchema = z.object({
  reason: z.string().trim().min(1, 'Tell the organizer what to fix').max(1000),
  note: noteSchema,
});
export type RejectInput = z.input<typeof rejectSchema>;
