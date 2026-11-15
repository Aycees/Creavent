import { z } from 'zod';
import { optionalLongText } from './events.js';

// Applications (spec §3.3, §4.2, data model §5.6).
export const applicationStatusSchema = z.enum(['submitted', 'approved', 'declined', 'removed', 'withdrawn']);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

// Up to 3 files per document requirement (spec §11.1).
export const MAX_FILES_PER_DOCUMENT = 3;

export const applySchema = z.object({
  categoryIds: z.array(z.uuid()).min(1, 'Pick at least one category').max(20),
  documents: z
    .array(z.object({ requirementId: z.uuid(), fileIds: z.array(z.uuid()).min(1).max(MAX_FILES_PER_DOCUMENT, `Upload at most ${MAX_FILES_PER_DOCUMENT} files`) }))
    .max(30)
    .default([]),
  // How many slots, up to the event's limit (decision P4).
  slotsRequested: z.number().int().min(1).max(10).default(1),
  // Preferences only, when the event lets vendors choose (spec §4.3), at most
  // as many as the slots asked for.
  preferredSlotIds: z.array(z.uuid()).max(10).default([]),
  note: optionalLongText(500),
}).refine((v) => new Set(v.preferredSlotIds).size === v.preferredSlotIds.length, { path: ['preferredSlotIds'], message: 'Pick each slot once' })
  .refine((v) => v.preferredSlotIds.length <= v.slotsRequested, { path: ['preferredSlotIds'], message: 'Pick at most as many slots as you need' });
export type ApplyInput = z.input<typeof applySchema>;

// Why a vendor can't apply right now. The page shows the reason instead of
// the form (flow 4).
export const applyBlockSchema = z.enum([
  'closed',
  'already_applied',
  'cannot_reapply',
  'no_matching_category',
  'profile_incomplete',
]);
export type ApplyBlock = z.infer<typeof applyBlockSchema>;

export const applyFormSchema = z.object({
  event: z.object({
    slug: z.string(),
    name: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    venueName: z.string().nullable(),
    applicationsCloseAt: z.string().nullable(),
    policy: z.string().nullable(),
    deadlineHours: z.number().int(),
    preferredSlots: z.boolean(),
    maxSlotsPerVendor: z.number().int(),
    vendorFloorPlanUrl: z.string().nullable(),
  }),
  blocked: applyBlockSchema.nullable(),
  // The vendor's active application here, when there is one.
  activeApplicationId: z.uuid().nullable(),
  // The vendor's categories that the event accepts, with spots left.
  categories: z.array(z.object({ id: z.uuid(), name: z.string(), max: z.number().int().nullable(), left: z.number().int().nullable() })),
  // The event's document requirements. With a category, only vendors applying
  // under it upload it.
  documents: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      description: z.string().nullable(),
      categoryId: z.uuid().nullable(),
      categoryName: z.string().nullable(),
      required: z.boolean(),
    }),
  ),
  // Slots grouped by section, each open or taken. Empty unless the event lets
  // vendors choose a preferred slot.
  slotGroups: z.array(
    z.object({
      name: z.string(),
      slots: z.array(
        z.object({
          id: z.uuid(),
          label: z.string(),
          sizeLabel: z.string().nullable(),
          note: z.string().nullable(),
          price: z.number().nullable(),
          taken: z.boolean(),
        }),
      ),
    }),
  ),
});
export type ApplyForm = z.infer<typeof applyFormSchema>;

export const createdApplicationSchema = z.object({ id: z.uuid() });

// What the vendor sees for one event: the application, slot, and payment
// together (spec §4.6, data model §7).
export const vendorStatusSchema = z.enum(['submitted', 'approved', 'slot_assigned', 'reserved', 'declined', 'withdrawn', 'removed']);
export type VendorStatus = z.infer<typeof vendorStatusSchema>;

export const vendorStatusLabels: Record<VendorStatus, string> = {
  submitted: 'Submitted',
  approved: 'Approved',
  slot_assigned: 'Slot assigned',
  reserved: 'Reserved',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  removed: 'Removed',
};

// From the application and its active assignment, if any.
export function vendorStatus(application: ApplicationStatus, assignment: 'assigned' | 'reserved' | null = null): VendorStatus {
  if (application === 'approved' && assignment === 'assigned') return 'slot_assigned';
  if (application === 'approved' && assignment === 'reserved') return 'reserved';
  return application;
}

// ─── Organizer review (spec §3.3, flow 5) ──────────────────────────────────

export const decisionSchema = z.object({ note: optionalLongText(500) });
export type DecisionInput = z.input<typeof decisionSchema>;

// A preferred slot as the organizer sees it now: still open, taken by
// someone else, or deleted ("No longer available", spec §5).
export const preferredSlotStateSchema = z.enum(['open', 'taken', 'removed']);
export const preferredSlotSchema = z.object({ id: z.uuid(), label: z.string(), state: preferredSlotStateSchema });

export const organizerApplicationSchema = z.object({
  id: z.uuid(),
  status: applicationStatusSchema,
  submittedAt: z.string(),
  decidedAt: z.string().nullable(),
  note: z.string().nullable(),
  decisionNote: z.string().nullable(),
  vendor: z.object({
    shopName: z.string(),
    slug: z.string().nullable(),
    fullName: z.string(),
    phone: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
  categories: z.array(z.object({ id: z.uuid(), name: z.string() })),
  documents: z.array(z.object({ id: z.uuid(), name: z.string(), url: z.string(), isPdf: z.boolean() })),
  slotsRequested: z.number().int(),
  preferredSlots: z.array(preferredSlotSchema),
  // Set on removal: whether the vendor may apply to this event again.
  canReapply: z.boolean().nullable(),
});
export type OrganizerApplication = z.infer<typeof organizerApplicationSchema>;

export const eventApplicationsSchema = z.object({
  event: z.object({ id: z.uuid(), slug: z.string(), name: z.string(), status: z.string(), applicationsOpen: z.boolean(), preferredSlots: z.boolean() }),
  // "Food: 4 of 5 accepted" (spec §3.2). A guide only.
  counters: z.array(z.object({ categoryId: z.uuid(), name: z.string(), approved: z.number().int(), max: z.number().int().nullable() })),
  applications: z.array(organizerApplicationSchema),
});
export type EventApplications = z.infer<typeof eventApplicationsSchema>;

// Allow or block a removed vendor from applying again (spec §3.3).
export const reapplySchema = z.object({ canReapply: z.boolean() });

// The vendor's change of plans (decided 2026-11-15). Empty: No preference.
const slotIds = z.array(z.uuid()).max(10).refine((ids) => new Set(ids).size === ids.length, 'Pick each slot once');
export const preferenceSchema = z.object({ preferredSlotIds: slotIds });
export const changeSlotSchema = z.object({ preferredSlotIds: slotIds.min(1, 'Pick at least one slot') });

// Open and taken slots for picking a new preference.
export const applicationSlotsSchema = z.object({
  currentSlotLabel: z.string().nullable(),
  slotsRequested: z.number().int(),
  preferredSlotIds: z.array(z.uuid()),
  vendorFloorPlanUrl: z.string().nullable(),
  slotGroups: applyFormSchema.shape.slotGroups,
});
export type ApplicationSlots = z.infer<typeof applicationSlotsSchema>;
