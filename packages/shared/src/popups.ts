import { z } from 'zod';
import { approvalStatusSchema } from './accounts.js';
import {
  blankAsNull,
  checkSchedule,
  dateString,
  eventCities,
  eventNameSchema,
  eventStatusSchema,
  optionalLongText,
  optionalText,
  timeString,
} from './events.js';
import { socialLinksSchema } from './onboarding.js';

// Pop-up events (spec §4.7, flow 12): a vendor's own event, with one store
// (theirs) and no organizer, applications, slots, or payments. Dates and
// times are Manila values, as on event setup.

// ─── Host approval ─────────────────────────────────────────────────────────

export const approvalSourceSchema = z.enum(['reviewed', 'earned']);
export type ApprovalSource = z.infer<typeof approvalSourceSchema>;

export const hostApprovalSchema = z.object({
  status: approvalStatusSchema,
  // How it was granted, once approved.
  source: approvalSourceSchema.nullable(),
  submittedAt: z.string().nullable(),
  // When an admin last decided, or when it was earned.
  decidedAt: z.string().nullable(),
  // The reason for a rejection or a revoke.
  rejectionReason: z.string().nullable(),
  // The latest decision was a revoke (spec §4.7).
  revoked: z.boolean(),
  // The vendor role is suspended: nothing can be announced or changed.
  suspended: z.boolean(),
  socialLinks: z.array(z.string()),
  // The links at the last decision. Adding one that isn't here sends an
  // approved host back to review.
  reviewedLinks: z.array(z.string()),
  // Approved just now through the earned route, so the page says so once.
  justEarned: z.boolean(),
});
export type HostApproval = z.infer<typeof hostApprovalSchema>;

// Submit for review: at least one social link, saved on the vendor page.
export const hostRequestSchema = z.object({
  socialLinks: socialLinksSchema.min(1, 'Add at least one link'),
});
export type HostRequestInput = z.input<typeof hostRequestSchema>;

// ─── The pop-up form ───────────────────────────────────────────────────────

export const createPopupSchema = z.object({ name: eventNameSchema });
export type CreatePopupInput = z.input<typeof createPopupSchema>;

export const createdPopupSchema = z.object({ id: z.uuid() });

// One form, no tabs (sitemap, pop-up pages). Every field but the name may be
// empty while it is a draft; Announce checks the rest.
export const popupDetailsSchema = z
  .object({
    name: eventNameSchema,
    description: optionalLongText(2000),
    startDate: blankAsNull(dateString),
    endDate: blankAsNull(dateString),
    opensAt: blankAsNull(timeString),
    closesAt: blankAsNull(timeString),
    venueName: optionalText(120),
    addressLine: optionalText(200),
    city: blankAsNull(z.enum(eventCities, 'Pick a city')),
    coverFileId: z.uuid().nullable(),
  })
  .superRefine((v, ctx) => {
    checkSchedule(v, ctx);
  });
export type PopupDetailsInput = z.input<typeof popupDetailsSchema>;

export const cancelPopupSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, 'Use at most 500 characters')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

// "Before you announce" (spec §4.7).
export const popupChecklistSchema = z.object({
  about: z.boolean(),
  cover: z.boolean(),
  schedule: z.boolean(),
  venue: z.boolean(),
  // Shop name, mobile number, and at least one category.
  profile: z.boolean(),
  // An approved host whose vendor role isn't suspended.
  host: z.boolean(),
});
export type PopupChecklist = z.infer<typeof popupChecklistSchema>;

// Why the form can't be changed right now, or null when it can.
export const popupLockSchema = z.enum(['canceled', 'ended', 'hidden', 'suspended', 'pending_review']).nullable();
export type PopupLock = z.infer<typeof popupLockSchema>;

export const popupSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  status: eventStatusSchema,
  details: z.object({
    name: z.string(),
    description: z.string().nullable(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    opensAt: z.string().nullable(),
    closesAt: z.string().nullable(),
    venueName: z.string().nullable(),
    addressLine: z.string().nullable(),
    city: z.string().nullable(),
    cover: z.object({ id: z.uuid(), url: z.string() }).nullable(),
  }),
  // The vendor profile parts the page shows: "Shows your shop".
  shop: z.object({ shopName: z.string(), categories: z.array(z.string()) }),
  checklist: popupChecklistSchema,
  host: hostApprovalSchema,
  lock: popupLockSchema,
  hiddenByCreavent: z.object({ reason: z.string().nullable() }).nullable(),
  canceled: z.object({ at: z.string(), reason: z.string().nullable() }).nullable(),
  ended: z.boolean(),
  updatedAt: z.string(),
});
export type Popup = z.infer<typeof popupSchema>;

// ─── My pop-ups ────────────────────────────────────────────────────────────

export const popupRowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  status: eventStatusSchema,
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  venueName: z.string().nullable(),
  hidden: z.boolean(),
  // "Set the dates and hours", "Get approved to announce", "On the events page".
  nextStep: z.string(),
});
export type PopupRow = z.infer<typeof popupRowSchema>;

export const popupsSchema = z.object({
  host: hostApprovalSchema,
  upcoming: z.array(popupRowSchema),
  past: z.array(popupRowSchema),
});
export type Popups = z.infer<typeof popupsSchema>;

// "Your pop-ups" on the vendor dashboard: the next two, and how many in all.
export const popupSummarySchema = z.object({
  host: hostApprovalSchema,
  upcoming: z.array(popupRowSchema),
  total: z.number().int(),
});
export type PopupSummary = z.infer<typeof popupSummarySchema>;
