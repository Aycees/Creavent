import { z } from 'zod';
import { roleTypeSchema } from './accounts.js';

// Reports and moderation (spec §2, §2.2, flow 11).

export const reportTargetSchema = z.enum(['user', 'event']);
export type ReportTarget = z.infer<typeof reportTargetSchema>;

export const reportReasonSchema = z.enum(['fake_account', 'scam', 'inappropriate_content', 'other']);
export type ReportReason = z.infer<typeof reportReasonSchema>;

export const reportSourceSchema = z.enum(['report_button', 'support_email']);
export const reportStatusSchema = z.enum(['open', 'dismissed', 'actioned']);
export const reportActionSchema = z.enum(['none', 'event_hidden', 'user_suspended', 'other']);

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  fake_account: 'Fake event or account',
  scam: 'Scam',
  inappropriate_content: 'Inappropriate content',
  other: 'Something else',
};

// RPT-0142.
export function reportNumber(n: number) {
  return `RPT-${String(n).padStart(4, '0')}`;
}

const optionalText = z
  .string()
  .trim()
  .max(2000, 'Use at most 2,000 characters')
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

// What the report button points at: an event, or a person through their
// public organizer or vendor page, by that page's id. User ids are never
// public; the API finds the person.
export const reportButtonTargetSchema = z.enum(['event', 'organizer', 'vendor']);
export type ReportButtonTarget = z.infer<typeof reportButtonTargetSchema>;

// The report button (signed-in users).
export const createReportSchema = z.object({
  targetType: reportButtonTargetSchema,
  targetId: z.uuid(),
  reason: reportReasonSchema,
  details: optionalText,
});
export type CreateReportInput = z.input<typeof createReportSchema>;

export const reportCreatedSchema = z.object({ number: z.number().int() });

// The viewer's open report about a target, so the page shows "You reported
// this", and whether the page is the viewer's own, so it offers no report.
export const myReportSchema = z.object({ number: z.number().int().nullable(), own: z.boolean() });

// An admin adds a report that reached the support inbox.
export const addEmailReportSchema = z.object({
  reporterEmail: z.email('Enter the sender’s email'),
  targetType: reportTargetSchema,
  targetId: z.uuid('Choose what the report is about'),
  reason: reportReasonSchema,
  details: z.string().trim().min(1, 'Paste what they said').max(4000),
});
export type AddEmailReportInput = z.input<typeof addEmailReportSchema>;

// What a report is about, as the admin pages show it.
export const reportTargetSummarySchema = z.object({
  type: reportTargetSchema,
  id: z.uuid(),
  name: z.string(),
  // "Mega Sale DVO · announced" or "Vendor, Kalye Kicks".
  subtitle: z.string(),
  startsAt: z.string().nullable(),
});
export type ReportTargetSummary = z.infer<typeof reportTargetSummarySchema>;

// One row of the queue: every report about one target, oldest first.
export const reportGroupSchema = z.object({
  // The oldest report in the group. Its page shows the whole group.
  id: z.uuid(),
  target: reportTargetSummarySchema,
  count: z.number().int(),
  reasons: z.array(reportReasonSchema),
  fromEmail: z.boolean(),
  oldestAt: z.string(),
  status: reportStatusSchema,
  actionTaken: reportActionSchema.nullable(),
  resolvedAt: z.string().nullable(),
});
export type ReportGroup = z.infer<typeof reportGroupSchema>;

export const reportGroupsSchema = z.object({ items: z.array(reportGroupSchema), openCount: z.number().int(), resolvedCount: z.number().int() });

const roleStateSchema = z.object({ role: roleTypeSchema, name: z.string().nullable(), suspended: z.boolean() });

export const reportDetailSchema = z.object({
  id: z.uuid(),
  status: reportStatusSchema,
  actionTaken: reportActionSchema.nullable(),
  resolvedAt: z.string().nullable(),
  resolvedByName: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  target: reportTargetSummarySchema.extend({
    // Events: the organizer, for "Suspend the organizer role".
    organizer: z.object({ userId: z.uuid(), name: z.string(), suspended: z.boolean() }).nullable(),
    hidden: z.boolean(),
    // Users: the roles that can be suspended.
    roles: z.array(roleStateSchema),
  }),
  reports: z.array(
    z.object({
      number: z.number().int(),
      reason: reportReasonSchema,
      details: z.string().nullable(),
      source: reportSourceSchema,
      // "Maria Santos (vendor, Lola's Ukay)" or the sender's email.
      reporter: z.string(),
      addedBy: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
});
export type ReportDetail = z.infer<typeof reportDetailSchema>;

const moderationReasonSchema = z.string().trim().min(1, 'Write the reason they will see').max(1000);

export const resolveReportSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('dismiss'), note: optionalText }),
  z.object({ decision: z.literal('hide_event'), reason: moderationReasonSchema, note: optionalText }),
  z.object({
    decision: z.literal('suspend_role'),
    role: roleTypeSchema,
    reason: moderationReasonSchema,
    note: optionalText,
    // Organizers: hide their upcoming events too (decision R1).
    hideUpcomingEvents: z.boolean().optional(),
  }),
]);
export type ResolveReportInput = z.input<typeof resolveReportSchema>;

// Moderation outside a report (spec §2): suspend or reinstate a role, hide or
// show an event.
export const suspendRoleSchema = z.object({
  reason: moderationReasonSchema,
  // Organizers: hide their upcoming events with the same reason (decided 2026-11-17).
  hideUpcomingEvents: z.boolean().optional(),
});
export type SuspendRoleInput = z.input<typeof suspendRoleSchema>;

export const hideEventSchema = z.object({ reason: moderationReasonSchema });
export type HideEventInput = z.input<typeof hideEventSchema>;

export const myReportQuerySchema = z.object({ targetType: reportButtonTargetSchema, targetId: z.uuid() });
export const reportListQuerySchema = z.object({ status: z.enum(['open', 'resolved']).default('open') });

// Admin search in the header (sitemap §5): people and events, up to 5 each.
export const adminSearchQuerySchema = z.object({ q: z.string().trim().min(1).max(100) });
export const adminSearchSchema = z.object({
  people: z.array(z.object({ id: z.uuid(), name: z.string(), email: z.string(), subtitle: z.string(), suspended: z.boolean() })),
  events: z.array(z.object({ id: z.uuid(), name: z.string(), subtitle: z.string(), startsAt: z.string().nullable() })),
});
export type AdminSearchResult = z.infer<typeof adminSearchSchema>;
