import { z } from 'zod';
import { eventStatusSchema } from './events.js';

// What vendors see (spec §4.2, sitemap §3): Browse events and the vendor view
// of the event page. Dates and times are Manila values, as on the setup page.

const organizerSchema = z.object({
  displayName: z.string(),
  slug: z.string().nullable(),
  logoUrl: z.string().nullable(),
  // "Approved by Creavent" (data model §7).
  approved: z.boolean(),
});

const scheduleFields = {
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
};

export const vendorEventCardSchema = z.object({
  slug: z.string(),
  name: z.string(),
  typeName: z.string(),
  status: eventStatusSchema,
  ...scheduleFields,
  venueName: z.string().nullable(),
  city: z.string().nullable(),
  coverUrl: z.string().nullable(),
  organizer: organizerSchema,
  feeRange: z.string().nullable(),
  applicationsCloseAt: z.string().nullable(),
  acceptingApplications: z.boolean(),
  preferredSlots: z.boolean(),
  // Spots left in the vendor's own categories, where the organizer set a limit.
  mySpots: z.array(z.object({ categoryName: z.string(), left: z.number().int(), max: z.number().int() })),
});
export type VendorEventCard = z.infer<typeof vendorEventCardSchema>;

export const vendorEventsResponseSchema = z.object({ events: z.array(vendorEventCardSchema) });

export const vendorEventsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  when: z.enum(['any', 'weekend', '30d']).optional(),
  city: z.string().trim().max(60).optional(),
});

export const vendorEventSchema = z.object({
  slug: z.string(),
  name: z.string(),
  typeName: z.string(),
  status: eventStatusSchema,
  ...scheduleFields,
  venueName: z.string().nullable(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  description: z.string().nullable(),
  coverUrl: z.string().nullable(),
  organizer: organizerSchema,
  applicationsCloseAt: z.string().nullable(),
  acceptingApplications: z.boolean(),
  categories: z.array(z.object({ id: z.uuid(), name: z.string(), max: z.number().int().nullable(), left: z.number().int().nullable() })),
  documents: z.array(z.object({ name: z.string(), categoryName: z.string().nullable() })),
  preferredSlots: z.boolean(),
  slotGroups: z.array(
    z.object({
      name: z.string(),
      range: z.string(),
      sizes: z.string().nullable(),
      notes: z.string().nullable(),
      feeRange: z.string().nullable(),
      open: z.number().int(),
      total: z.number().int(),
    }),
  ),
  vendorFloorPlanUrl: z.string().nullable(),
  policy: z.string().nullable(),
  summary: z.object({ feeRange: z.string().nullable(), deadlineHours: z.number().int(), paidTo: z.string().nullable() }),
  vendorContactInfo: z.string().nullable(),
  // The viewer's vendor categories, for "Your category is accepted".
  myCategoryIds: z.array(z.uuid()),
});
export type VendorEvent = z.infer<typeof vendorEventSchema>;

export const eventPageSchema = z.discriminatedUnion('view', [
  // Signed out, or not a vendor, while the event is only open to vendors.
  // The public view comes with Phase 4 (sitemap §3).
  z.object({ view: z.literal('not_public') }),
  z.object({ view: z.literal('vendor'), preview: z.boolean(), event: vendorEventSchema }),
]);
export type EventPage = z.infer<typeof eventPageSchema>;
