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
});
export type EventSetup = z.infer<typeof eventSetupSchema>;

export const createdEventSchema = z.object({ id: z.uuid() });
