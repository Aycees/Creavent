import { z } from 'zod';
import { HIDDEN_CHARS } from './text.js';

// Events (spec §3.1, §3.1.1, data model §5.4).

export const eventStatusSchema = z.enum(['draft', 'open_to_vendors', 'announced', 'completed', 'canceled']);
export type EventStatus = z.infer<typeof eventStatusSchema>;

// The launch area (spec §10). More cities are added here.
export const eventCities = ['Davao City'] as const;

// Events run 1 to 7 days in a row (spec §3.1.1).
export const MAX_EVENT_DAYS = 7;

// An announcement can be undone for this long, for one made by mistake or
// too early (decision Q9). After that, edit or cancel the event.
export const UNDO_ANNOUNCE_MINUTES = 10;

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

export const text = (max: number, label = 'text') =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .refine((v) => !HIDDEN_CHARS.test(v), `This ${label} has hidden characters. Type it again.`);

// Long text people write in paragraphs (a description, a policy): line breaks
// and tabs are kept, and Windows line endings become plain ones. Other hidden
// characters are still refused.
const longText = (max: number, label = 'text') =>
  z
    .string()
    .transform((v) => v.replace(/\r\n?/g, '\n').trim())
    .pipe(
      z
        .string()
        .max(max, `Use at most ${max} characters`)
        .refine((v) => !HIDDEN_CHARS.test(v.replace(/[\n\t]/g, '')), `This ${label} has hidden characters. Type it again.`),
    );

const blankToNull = <T extends z.ZodType<string, string>>(schema: T) =>
  schema
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

// Optional text: blank is saved as null.
const optionalText = (max: number) => blankToNull(text(max));
export const optionalLongText = (max: number) => blankToNull(longText(max));

// A real calendar date: "2027-02-31" is refused, not moved to March.
const isRealDate = (d: string) => {
  const parsed = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === d.slice(0, 10);
};
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date').refine(isRealDate, 'Pick a date');
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Pick a time');
const dateTimeString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, 'Pick a date and time')
  .refine(isRealDate, 'Pick a date and time');
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
    description: optionalLongText(2000),
    startDate: blankAsNull(dateString),
    endDate: blankAsNull(dateString),
    opensAt: blankAsNull(timeString),
    closesAt: blankAsNull(timeString),
    venueName: optionalText(120),
    addressLine: optionalText(200),
    city: blankAsNull(z.enum(eventCities, 'Pick a city')),
    coverFileId: z.uuid().nullable(),
    vendorContactInfo: optionalLongText(500),
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
  text: longText(5000, 'policy').pipe(z.string().min(1, 'Write your policy, or keep the example')),
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

// The Slots tab (spec §3.4).
export const slotModeSchema = z.enum(['organizer_assigns', 'vendor_preference']);
export type SlotMode = z.infer<typeof slotModeSchema>;

// Pesos, at most 2 decimals. Null: use the event's default price.
const priceSchema = z
  .number('Enter a price')
  .min(0, "Prices can't be negative")
  .max(1_000_000, 'Use at most ₱1,000,000')
  // With a tolerance, because 19.99 * 100 is 1998.9999999999998 in floating point.
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Use at most 2 decimals')
  .nullable();

export const MAX_SLOTS_PER_ROW = 200;

export const slotSchema = z.object({
  label: text(20, 'slot number').min(1, 'Enter the slot number'),
  section: optionalText(60),
  sizeLabel: optionalText(40),
  note: optionalText(120),
  price: priceSchema,
});
export type SlotInput = z.input<typeof slotSchema>;

// "Add a row of slots": a prefix and a number range, for example C, 01 to 06.
export const slotRowSchema = z
  .object({
    section: optionalText(60),
    prefix: text(10, 'prefix'),
    from: z.string().trim().regex(/^\d{1,4}$/, 'Use a number'),
    to: z.string().trim().regex(/^\d{1,4}$/, 'Use a number'),
    sizeLabel: optionalText(40),
    price: priceSchema,
  })
  .superRefine((v, ctx) => {
    const from = Number(v.from);
    const to = Number(v.to);
    if (to < from) ctx.addIssue({ code: 'custom', path: ['to'], message: 'End at or after the first number' });
    else if (to - from + 1 > MAX_SLOTS_PER_ROW) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: `Add up to ${MAX_SLOTS_PER_ROW} slots at once` });
    }
  });
export type SlotRowInput = z.input<typeof slotRowSchema>;

// The labels a row makes: the prefix, a hyphen, and the number padded like
// the first number ("01" to "06" → C-01 to C-06).
export function rowLabels(row: { prefix: string; from: string; to: string }) {
  const width = row.from.startsWith('0') ? row.from.length : 1;
  const out: string[] = [];
  for (let n = Number(row.from); n <= Number(row.to); n += 1) {
    const num = String(n).padStart(width, '0');
    out.push(row.prefix.trim() ? `${row.prefix.trim()}-${num}` : num);
  }
  return out;
}

// Slots grouped for display: by section, or by the label's prefix when a slot
// has no section ("C-01" → "C"). Groups keep the order of their first slot
// (spec §3.4).
export function groupSlots<T extends { label: string; section: string | null }>(slots: T[]) {
  const groups = new Map<string, T[]>();
  for (const slot of slots) {
    const prefix = /^(.*?[A-Za-z])[-\s]?\d+$/.exec(slot.label)?.[1];
    const name = slot.section ?? prefix ?? 'Other slots';
    groups.set(name, [...(groups.get(name) ?? []), slot]);
  }
  return [...groups].map(([name, list]) => ({ name, slots: list }));
}

// One vendor can ask for and hold up to this many slots (decision P2).
export const MAX_SLOTS_PER_VENDOR = 10;

export const slotSettingsSchema = z.object({
  mode: slotModeSchema,
  defaultPrice: priceSchema,
  vendorFloorPlanFileId: z.uuid().nullable(),
  maxSlotsPerVendor: z.number().int().min(1).max(MAX_SLOTS_PER_VENDOR, `Allow up to ${MAX_SLOTS_PER_VENDOR} slots per vendor`).default(1),
});

// Keep a slot for the organizer's own booth or a sponsor (decision P1).
export const setAsideSchema = z.object({ setAside: z.boolean(), note: optionalText(120) });
export type SetAsideInput = z.input<typeof setAsideSchema>;
export type SlotSettingsInput = z.input<typeof slotSettingsSchema>;

export const publicFloorPlanSchema = z.object({ fileId: z.uuid().nullable() });

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

// The five required steps before opening to vendors (spec §3.1).
export const eventChecklistSchema = z.object({
  details: z.boolean(),
  requirements: z.boolean(),
  policy: z.boolean(),
  slots: z.boolean(),
  payments: z.boolean(),
});
export type EventChecklist = z.infer<typeof eventChecklistSchema>;

export const applicationsToggleSchema = z.object({ open: z.boolean() });

// Everything the setup page shows (sitemap §4). Each save answers with it.
export const eventSetupSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  status: eventStatusSchema,
  applicationsOpen: z.boolean(),
  checklist: eventChecklistSchema,
  // Approved and not suspended: needed to open to vendors (spec §2.1).
  organizerApproved: z.boolean(),
  // An admin hid the event, with the reason the organizer was emailed (spec §2).
  hiddenByCreavent: z.object({ reason: z.string().nullable() }).nullable(),
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
  // For the Announce and Cancel confirm steps (flows 8 and 9).
  lineup: z.object({
    // Vendors with a reserved slot: shown on the event page once announced.
    confirmedVendors: z.number().int(),
    // Vendors with a submitted or approved application: emailed on a cancel
    // or a change (decision Q6).
    activeVendors: z.number().int(),
    // Assigned slots whose payment isn't approved yet, overdue first.
    unpaid: z.array(
      z.object({ slotLabel: z.string(), shopName: z.string(), state: z.enum(['overdue', 'proof_submitted', 'waiting']) }),
    ),
  }),
  // The last day has ended (Manila time).
  ended: z.boolean(),
  // While the announcement can still be undone (decision Q9).
  undoAnnounceUntil: z.string().nullable(),
  canceled: z.object({ at: z.string(), reason: z.string().nullable() }).nullable(),
  slots: z.object({
    mode: slotModeSchema,
    defaultPrice: z.number().nullable(),
    maxSlotsPerVendor: z.number().int(),
    vendorFloorPlan: imageSchema.nullable(),
    publicFloorPlan: imageSchema.nullable(),
    list: z.array(
      z.object({
        id: z.uuid(),
        label: z.string(),
        section: z.string().nullable(),
        sizeLabel: z.string().nullable(),
        note: z.string().nullable(),
        // The slot's own price. Null: the default price.
        price: z.number().nullable(),
        // Kept by the organizer, with their private note (decision P1).
        setAside: z.object({ note: z.string().nullable() }).nullable(),
      }),
    ),
  }),
});
export type EventSetup = z.infer<typeof eventSetupSchema>;

// Cancel event takes an optional reason, shown to vendors (decision Q4).
export const cancelEventSchema = z.object({ reason: optionalLongText(500).optional().transform((v) => v ?? null) });

export const createdEventSchema = z.object({ id: z.uuid() });

// One row of the organizer's event list (spec §3.8).
export const organizerEventRowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  typeName: z.string(),
  status: eventStatusSchema,
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  venueName: z.string().nullable(),
  slotCount: z.number().int(),
  nextStep: z.string(),
  // How the slots are filled, once the event is open to vendors.
  fill: z.object({ reserved: z.number().int(), assigned: z.number().int(), open: z.number().int() }).nullable(),
});
export type OrganizerEventRow = z.infer<typeof organizerEventRowSchema>;

// "To do for Bajada Christmas Flea" (spec §3.8), for events open to vendors
// or announced with something waiting.
export const organizerTodoSchema = z.object({
  eventId: z.uuid(),
  name: z.string(),
  applicationsToReview: z.number().int(),
  oldestApplicationAt: z.string().nullable(),
  proofsToCheck: z.number().int(),
  proofsTotal: z.number(),
  overduePayments: z.number().int(),
  approvedNoSlot: z.number().int(),
  openSlots: z.number().int(),
});
export type OrganizerTodo = z.infer<typeof organizerTodoSchema>;

export const organizerEventsSchema = z.object({
  todo: z.array(organizerTodoSchema),
  upcoming: z.array(organizerEventRowSchema),
  past: z.array(organizerEventRowSchema),
});
export type OrganizerEvents = z.infer<typeof organizerEventsSchema>;
