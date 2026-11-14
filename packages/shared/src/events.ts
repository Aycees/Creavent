import { z } from 'zod';
import { HIDDEN_CHARS } from './text.js';

// Events (spec §3.1, §3.1.1, data model §5.4).

export const eventStatusSchema = z.enum(['draft', 'open_to_vendors', 'announced', 'completed', 'canceled']);
export type EventStatus = z.infer<typeof eventStatusSchema>;

// The launch area (spec §10). More cities are added here.
export const eventCities = ['Davao City'] as const;

// Events run 1 to 7 days in a row (spec §3.1.1).
export const MAX_EVENT_DAYS = 7;

// Every time is shown and entered in Asia/Manila, which is UTC+8 all year.
const MANILA_OFFSET = '+08:00';

// "2027-01-15" and "17:00" in Manila, as an instant.
export function manilaInstant(date: string, time: string) {
  return new Date(`${date}T${time}:00${MANILA_OFFSET}`);
}

// An instant as its Manila date ("2027-01-15") and time ("17:00").
export function manilaParts(instant: Date | string) {
  const shifted = new Date(new Date(instant).getTime() + 8 * 60 * 60 * 1000).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

// Whole days from one "YYYY-MM-DD" to another.
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const text = (max: number, label = 'text') =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .refine((v) => !HIDDEN_CHARS.test(v), `This ${label} has hidden characters. Type it again.`);

// Optional text: blank is saved as null.
const optionalText = (max: number) =>
  text(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date');
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Pick a time');
const dateTimeString = z.string().regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, 'Pick a date and time');
// Blank form fields are saved as null.
const blankAsNull = <T extends z.ZodType<string>>(schema: T) =>
  z
    .union([z.literal(''), schema])
    .nullable()
    .optional()
    .transform((v) => (v ? (v as z.output<T>) : null));

export const eventNameSchema = text(100, 'name').min(1, 'Enter the event name');

export const createEventSchema = z.object({
  name: eventNameSchema,
  eventTypeId: z.uuid('Pick an event type'),
});
export type CreateEventInput = z.input<typeof createEventSchema>;

export const eventDetailsSchema = z
  .object({
    name: eventNameSchema,
    eventTypeId: z.uuid('Pick an event type'),
    description: optionalText(2000),
    startDate: blankAsNull(dateString),
    endDate: blankAsNull(dateString),
    opensAt: blankAsNull(timeString),
    closesAt: blankAsNull(timeString),
    venueName: optionalText(120),
    addressLine: optionalText(200),
    city: blankAsNull(z.enum(eventCities, 'Pick a city')),
    coverFileId: z.uuid().nullable(),
    vendorContactInfo: optionalText(500),
    applicationsCloseAt: blankAsNull(dateTimeString),
    ingressInfo: optionalText(200),
  })
  .superRefine((v, ctx) => {
    const schedule = [v.startDate, v.endDate, v.opensAt, v.closesAt];
    const filled = schedule.filter(Boolean).length;
    if (filled > 0 && filled < 4) {
      const names = ['startDate', 'endDate', 'opensAt', 'closesAt'] as const;
      for (const [i, name] of names.entries()) {
        if (!schedule[i]) ctx.addIssue({ code: 'custom', path: [name], message: 'Fill in the dates and both times' });
      }
      return;
    }
    if (v.startDate && v.endDate && v.opensAt && v.closesAt) {
      const days = daysBetween(v.startDate, v.endDate);
      if (days < 0) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End on or after the start date' });
      else if (days >= MAX_EVENT_DAYS) {
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: `An event runs at most ${MAX_EVENT_DAYS} days in a row` });
      }
      if (v.closesAt <= v.opensAt) {
        ctx.addIssue({ code: 'custom', path: ['closesAt'], message: 'Close later than it opens, on the same day' });
      }
      if (v.applicationsCloseAt && v.applicationsCloseAt > `${v.startDate}T${v.opensAt}`) {
        ctx.addIssue({ code: 'custom', path: ['applicationsCloseAt'], message: 'Close applications before the event starts' });
      }
    }
  });
export type EventDetailsInput = z.input<typeof eventDetailsSchema>;

// The Requirements tab (spec §3.2).
export const eventRequirementsSchema = z
  .object({
    categories: z
      .array(
        z.object({
          categoryId: z.uuid(),
          maxVendors: z.number().int().min(1, 'Use 1 or more, or leave it empty').max(999).nullable(),
        }),
      )
      .max(50),
    documents: z
      .array(
        z.object({
          id: z.uuid().optional(),
          name: text(100, 'name').min(1, 'Name the document'),
          description: optionalText(300),
          // Null: every vendor uploads it. Else only vendors in this category.
          categoryId: z.uuid().nullable(),
        }),
      )
      .max(20, 'Ask for up to 20 documents'),
  })
  .refine((v) => new Set(v.categories.map((c) => c.categoryId)).size === v.categories.length, {
    path: ['categories'],
    message: 'Pick each category once',
  });
export type EventRequirementsInput = z.input<typeof eventRequirementsSchema>;

// The Policy tab (spec §3.7).
export const eventPolicySchema = z.object({
  text: text(5000, 'policy').min(1, 'Write your policy, or keep the example'),
});
export type EventPolicyInput = z.input<typeof eventPolicySchema>;

// The Payments tab (spec §6.1).
export const paymentChannelSchema = z.enum(['gcash', 'maya', 'bank', 'other']);
export type PaymentChannel = z.infer<typeof paymentChannelSchema>;

export const paymentChannelLabels: Record<PaymentChannel, string> = {
  gcash: 'GCash',
  maya: 'Maya',
  bank: 'Bank transfer',
  other: 'Other',
};

export const eventPaymentsSchema = z.object({
  deadlineHours: z
    .number('Enter the hours')
    .int('Use whole hours')
    .min(1, 'Use at least 1 hour')
    .max(168, 'Use at most 168 hours (7 days)'),
  methods: z
    .array(
      z
        .object({
          id: z.uuid().optional(),
          channel: paymentChannelSchema,
          accountName: text(100, 'name').min(1, 'Enter the account name'),
          accountNumber: optionalText(60),
          qrFileId: z.uuid().nullable(),
          notes: optionalText(300),
        })
        .refine((m) => m.accountNumber || m.qrFileId, {
          path: ['accountNumber'],
          message: 'Add the account number or a QR code',
        }),
    )
    .max(10, 'Add up to 10 options'),
});
export type EventPaymentsInput = z.input<typeof eventPaymentsSchema>;

const imageSchema = z.object({ id: z.uuid(), url: z.string() });

export const eventTypeSchema = z.object({ id: z.uuid(), name: z.string(), slug: z.string() });
export type EventType = z.infer<typeof eventTypeSchema>;

export const eventDetailsStateSchema = z.object({
  name: z.string(),
  eventTypeId: z.uuid(),
  description: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  venueName: z.string().nullable(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  cover: imageSchema.nullable(),
  vendorContactInfo: z.string().nullable(),
  applicationsCloseAt: z.string().nullable(),
  ingressInfo: z.string().nullable(),
});

// Everything the setup page shows (sitemap §4). Each save answers with it.
export const eventSetupSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  status: eventStatusSchema,
  applicationsOpen: z.boolean(),
  details: eventDetailsStateSchema,
  eventTypes: z.array(eventTypeSchema),
  // Active product categories, for the Requirements tab.
  categories: z.array(z.object({ id: z.uuid(), name: z.string() })),
  requirements: z.object({
    categories: z.array(z.object({ categoryId: z.uuid(), maxVendors: z.number().int().nullable() })),
    documents: z.array(
      z.object({ id: z.uuid(), name: z.string(), description: z.string().nullable(), categoryId: z.uuid().nullable() }),
    ),
  }),
  policy: z.object({
    text: z.string().nullable(),
    // The event the text was copied from, while it is still the copied text.
    copiedFrom: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    // Shown on a first event until the organizer saves a policy.
    example: z.string(),
  }),
  payments: z.object({
    deadlineHours: z.number().int(),
    // Active options only.
    methods: z.array(
      z.object({
        id: z.uuid(),
        channel: paymentChannelSchema,
        label: z.string(),
        accountName: z.string().nullable(),
        accountNumber: z.string().nullable(),
        qr: imageSchema.nullable(),
        notes: z.string().nullable(),
      }),
    ),
  }),
});
export type EventSetup = z.infer<typeof eventSetupSchema>;

export const createdEventSchema = z.object({ id: z.uuid() });
