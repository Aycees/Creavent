import { z } from 'zod';
import { eventStatusSchema } from './events.js';

// What anyone can see without an account (spec §7, sitemap §3): the event
// page, the listing, and the organizer and vendor pages. Dates and times are
// Manila values. Each response carries the cache tags the web app files the
// page under, so the API can ask for exactly those pages to be refreshed when
// something on them changes (decision Q1).

const scheduleFields = {
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
};

const cancellationSchema = z.object({ at: z.string(), reason: z.string().nullable() }).nullable();

export const publicOrganizerSchema = z.object({
  displayName: z.string(),
  // Null when the organizer page isn't available.
  slug: z.string().nullable(),
  logoUrl: z.string().nullable(),
  // "Approved by Creavent" (data model §7).
  approved: z.boolean(),
  about: z.string().nullable(),
  socialLinks: z.array(z.string()),
  // Completed events on Creavent (spec §7.1).
  eventsHeld: z.number().int(),
});

// A vendor with a reserved slot (spec §7). Slug is null when their page isn't
// available (suspended or deleted), so the name shows without a link.
export const publicVendorRowSchema = z.object({
  shopName: z.string(),
  slug: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  categories: z.array(z.string()),
  slotLabel: z.string(),
});
export type PublicVendorRow = z.infer<typeof publicVendorRowSchema>;

export const publicEventSchema = z.object({
  slug: z.string(),
  name: z.string(),
  typeName: z.string(),
  status: eventStatusSchema,
  ...scheduleFields,
  venueName: z.string().nullable(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  description: z.string().nullable(),
  coverUrl: z.string().nullable(),
  publicFloorPlanUrl: z.string().nullable(),
  organizer: publicOrganizerSchema,
  // Empty once the event is canceled (decision Q2).
  vendors: z.array(publicVendorRowSchema),
  // "Details updated Tue, Nov 10".
  updatedAt: z.string(),
  canceled: cancellationSchema,
});
export type PublicEvent = z.infer<typeof publicEventSchema>;

export const publicEventResponseSchema = z.object({
  tags: z.array(z.string()),
  page: z.discriminatedUnion('view', [
    z.object({ view: z.literal('public'), event: publicEventSchema }),
    // Open to vendors: visitors can't see it yet (flow 10).
    z.object({ view: z.literal('not_public') }),
    // Canceled before it was announced: the name and dates only (decision Q2).
    z.object({ view: z.literal('canceled_notice'), name: z.string(), ...scheduleFields, canceled: cancellationSchema }),
  ]),
});
export type PublicEventResponse = z.infer<typeof publicEventResponseSchema>;

// ─── Event listing (spec §7.3, flow 10) ────────────────────────────────────

export const listingWhenSchema = z.enum(['any', 'weekend', '2weeks', 'next_month', 'dates']);
export type ListingWhen = z.infer<typeof listingWhenSchema>;

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const listingQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  // An event type slug.
  type: z.string().trim().max(40).optional(),
  city: z.string().trim().max(60).optional(),
  when: listingWhenSchema.optional(),
  // With when=dates (Pick dates, or a calendar month).
  from: dateString.optional(),
  to: dateString.optional(),
});
export type ListingQuery = z.infer<typeof listingQuerySchema>;

export const listingCardSchema = z.object({
  slug: z.string(),
  name: z.string(),
  typeName: z.string(),
  ...scheduleFields,
  venueName: z.string().nullable(),
  city: z.string().nullable(),
  coverUrl: z.string().nullable(),
  organizer: z.object({ displayName: z.string(), approved: z.boolean() }),
});
export type ListingCard = z.infer<typeof listingCardSchema>;

export const listingSchema = z.object({
  tags: z.array(z.string()),
  // Today in Manila, which the weekend groups and the strip count from.
  today: z.string(),
  events: z.array(listingCardSchema),
  // Each active type with its count under the other filters.
  types: z.array(z.object({ slug: z.string(), name: z.string(), count: z.number().int() })),
  cities: z.array(z.string()),
  // "Next 7 days": each day with how many announced events run that day.
  next7: z.array(z.object({ date: z.string(), count: z.number().int() })),
  // "Sell at these events": events taking applications (spec §7.3).
  openToVendors: z.number().int(),
});
export type Listing = z.infer<typeof listingSchema>;
