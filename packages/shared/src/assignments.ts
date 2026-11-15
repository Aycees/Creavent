import { z } from 'zod';
import { paymentChannelSchema } from './events.js';
import { preferredSlotStateSchema, vendorStatusSchema } from './applications.js';

// Slot assignment and payments (spec §5, §6, data model §5.7).
export const assignmentStatusSchema = z.enum(['assigned', 'reserved', 'released', 'removed', 'canceled']);
export const paymentStatusSchema = z.enum(['pending', 'submitted', 'approved', 'rejected']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const assignSlotSchema = z.object({ applicationId: z.uuid(), slotId: z.uuid() });
export type AssignSlotInput = z.input<typeof assignSlotSchema>;

// One payment option as copied onto an assignment (spec §6.1).
export const paymentInstructionSchema = z.object({
  id: z.uuid(),
  channel: paymentChannelSchema,
  label: z.string(),
  accountName: z.string().nullable(),
  accountNumber: z.string().nullable(),
  qrFileId: z.uuid().nullable(),
  notes: z.string().nullable(),
});
export type PaymentInstruction = z.infer<typeof paymentInstructionSchema>;

// Slot status is worked out from the slot's active assignment (data model §7).
export const slotStateSchema = z.enum(['open', 'assigned', 'reserved']);

export const eventVendorsSchema = z.object({
  event: z.object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string(),
    status: z.string(),
    applicationsOpen: z.boolean(),
    preferredSlots: z.boolean(),
    deadlineHours: z.number().int(),
    waitingApplications: z.number().int(),
  }),
  // "Slots at a glance" (spec §3.4).
  glance: z.object({ open: z.number().int(), assigned: z.number().int(), reserved: z.number().int(), overdue: z.number().int() }),
  slots: z.array(
    z.object({
      id: z.uuid(),
      label: z.string(),
      section: z.string().nullable(),
      sizeLabel: z.string().nullable(),
      price: z.number().nullable(),
      state: slotStateSchema,
      overdue: z.boolean(),
      // Waiting applications that prefer this open slot ("Preferred by 2").
      preferredBy: z.number().int(),
    }),
  ),
  // Approved vendors without a slot (spec §5).
  unassigned: z.array(
    z.object({
      applicationId: z.uuid(),
      shopName: z.string(),
      categories: z.array(z.string()),
      preferredSlot: z.object({ id: z.uuid(), label: z.string(), state: preferredSlotStateSchema }).nullable(),
    }),
  ),
  assignments: z.array(
    z.object({
      id: z.uuid(),
      status: assignmentStatusSchema,
      slotLabel: z.string(),
      shopName: z.string(),
      phone: z.string().nullable(),
      amountDue: z.number(),
      paymentStatus: paymentStatusSchema,
      deadlineAt: z.string(),
      // Assigned, payment pending or rejected, deadline passed (spec §6.4).
      overdue: z.boolean(),
    }),
  ),
});
export type EventVendors = z.infer<typeof eventVendorsSchema>;

// ─── The vendor's application pages (spec §4.6, sitemap §5) ────────────────

const eventSummary = z.object({
  slug: z.string(),
  name: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  venueName: z.string().nullable(),
});

export const vendorApplicationRowSchema = z.object({
  id: z.uuid(),
  event: eventSummary,
  status: vendorStatusSchema,
  slotLabel: z.string().nullable(),
  amountDue: z.number().nullable(),
  paymentStatus: paymentStatusSchema.nullable(),
  deadlineAt: z.string().nullable(),
  decisionNote: z.string().nullable(),
});
export type VendorApplicationRow = z.infer<typeof vendorApplicationRowSchema>;

export const vendorApplicationsSchema = z.object({ applications: z.array(vendorApplicationRowSchema) });

export const vendorApplicationSchema = z.object({
  id: z.uuid(),
  status: vendorStatusSchema,
  submittedAt: z.string(),
  decidedAt: z.string().nullable(),
  decisionNote: z.string().nullable(),
  removalNote: z.string().nullable(),
  categories: z.array(z.string()),
  documentCount: z.number().int(),
  event: eventSummary.extend({
    addressLine: z.string().nullable(),
    city: z.string().nullable(),
    // Shown to vendors with a slot (spec §3.1).
    ingressInfo: z.string().nullable(),
    vendorFloorPlanUrl: z.string().nullable(),
  }),
  // Vendors who applied see the organizer's contact (spec §8.2).
  organizer: z.object({
    displayName: z.string(),
    fullName: z.string(),
    phone: z.string().nullable(),
    contactEmail: z.string().nullable(),
    approved: z.boolean(),
  }),
  // Shown until a slot is assigned (spec §4.6).
  preferredSlot: z.object({ label: z.string(), state: preferredSlotStateSchema }).nullable(),
  assignment: z
    .object({
      id: z.uuid(),
      status: assignmentStatusSchema,
      slotLabel: z.string(),
      sizeLabel: z.string().nullable(),
      note: z.string().nullable(),
      amountDue: z.number(),
      assignedAt: z.string(),
      deadlineAt: z.string(),
      reservedAt: z.string().nullable(),
      paymentStatus: paymentStatusSchema,
      // The payment options as they were when the slot was assigned.
      instructions: z.array(paymentInstructionSchema.extend({ qrUrl: z.string().nullable() })),
    })
    .nullable(),
});
export type VendorApplication = z.infer<typeof vendorApplicationSchema>;
