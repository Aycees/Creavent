import { z } from 'zod';
import { approvalStatusSchema, roleTypeSchema } from './accounts.js';
import { eventStatusSchema } from './events.js';
import { reportReasonSchema } from './reports.js';

// Admin users and events pages (spec §2, sitemap §6).

export const ADMIN_PAGE_SIZE = 25;

const pageSchema = z.coerce.number().int().min(1).default(1);

// One line of an admin's history of a user or event, from the audit log and reports.
const historyItemSchema = z.object({ at: z.string(), text: z.string() });

export const adminUsersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  filter: z.enum(['all', 'vendors', 'organizers', 'suspended']).default('all'),
  page: pageSchema,
});
export type AdminUsersFilter = z.infer<typeof adminUsersQuerySchema>['filter'];

const roleSummarySchema = z.object({
  role: roleTypeSchema,
  // Shop or organizer name.
  name: z.string().nullable(),
  approvalStatus: approvalStatusSchema.nullable(),
  suspended: z.boolean(),
});

export const adminUsersSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      fullName: z.string(),
      email: z.string(),
      joinedAt: z.string(),
      roles: z.array(roleSummarySchema),
      openReports: z.number().int(),
    }),
  ),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  counts: z.object({ all: z.number().int(), vendors: z.number().int(), organizers: z.number().int(), suspended: z.number().int() }),
});
export type AdminUsers = z.infer<typeof adminUsersSchema>;

export const adminUserSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  phone: z.string().nullable(),
  joinedAt: z.string(),
  lastLoginAt: z.string().nullable(),
  roles: z.array(
    roleSummarySchema.extend({
      slug: z.string().nullable(),
      reviewedAt: z.string().nullable(),
      suspendedAt: z.string().nullable(),
      suspendedByName: z.string().nullable(),
      suspensionReason: z.string().nullable(),
      // Organizers: visible events that haven't ended, for "Also hide their N upcoming events".
      upcomingEvents: z.number().int(),
    }),
  ),
  events: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      startsAt: z.string().nullable(),
      status: eventStatusSchema,
      hidden: z.boolean(),
      applied: z.number().int(),
      confirmed: z.number().int(),
    }),
  ),
  applications: z.array(
    z.object({
      eventId: z.uuid(),
      eventName: z.string(),
      startsAt: z.string().nullable(),
      status: z.string(),
      slotLabels: z.array(z.string()),
    }),
  ),
  reports: z.array(z.object({ id: z.uuid(), number: z.number().int(), reason: reportReasonSchema, open: z.boolean(), about: z.string() })),
  history: z.array(historyItemSchema),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminEventsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  filter: z.enum(['all', 'open', 'announced', 'reported', 'hidden', 'drafts']).default('all'),
  page: pageSchema,
});
export type AdminEventsFilter = z.infer<typeof adminEventsQuerySchema>['filter'];

export const adminEventsSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      startsAt: z.string().nullable(),
      typeName: z.string(),
      venueName: z.string().nullable(),
      organizerName: z.string(),
      status: eventStatusSchema,
      hidden: z.boolean(),
      slots: z.number().int(),
      confirmed: z.number().int(),
      openReports: z.number().int(),
    }),
  ),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  counts: z.object({
    all: z.number().int(),
    open: z.number().int(),
    announced: z.number().int(),
    reported: z.number().int(),
    hidden: z.number().int(),
    drafts: z.number().int(),
  }),
});
export type AdminEvents = z.infer<typeof adminEventsSchema>;

const privateFileSchema = z.object({ fileId: z.uuid(), label: z.string() });

export const adminEventSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  status: eventStatusSchema,
  startsAt: z.string().nullable(),
  venueName: z.string().nullable(),
  city: z.string().nullable(),
  hidden: z.boolean(),
  moderationReason: z.string().nullable(),
  moderatedAt: z.string().nullable(),
  moderatedByName: z.string().nullable(),
  organizer: z.object({ userId: z.uuid(), name: z.string(), fullName: z.string(), approved: z.boolean(), suspended: z.boolean() }),
  slots: z.object({ total: z.number().int(), assigned: z.number().int(), reserved: z.number().int() }),
  applications: z.array(
    z.object({
      id: z.uuid(),
      shopName: z.string(),
      vendorUserId: z.uuid(),
      status: z.string(),
      slotLabels: z.array(z.string()),
      documents: z.array(privateFileSchema),
      proofs: z.array(privateFileSchema),
    }),
  ),
  // The oldest open report, to open the group, and how many are open.
  openReports: z.object({ count: z.number().int(), reportId: z.uuid().nullable() }),
  history: z.array(historyItemSchema),
});
export type AdminEvent = z.infer<typeof adminEventSchema>;
