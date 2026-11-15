import { z } from 'zod';
import { eventStatusSchema, optionalLongText, paymentChannelSchema, text } from './events.js';
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

// ─── Proof of payment (spec §6.2, §6.3) ────────────────────────────────────

export const proofStatusSchema = z.enum(['submitted', 'approved', 'rejected']);
const money = z.number().min(0, 'Enter an amount of ₱0 or more').max(10_000_000).multipleOf(0.01, 'Use at most 2 decimal places');

export const uploadProofSchema = z.object({
  fileId: z.uuid(),
  // The option the vendor paid with (required).
  paymentMethodId: z.uuid('Pick the option you paid with'),
  amountClaimed: money,
  referenceNumber: text(60, 'reference number').transform((v) => v || null).nullable().default(null),
  note: optionalLongText(300),
});
export type UploadProofInput = z.input<typeof uploadProofSchema>;

export const approveProofSchema = z.object({ amountPaid: money.nullable().default(null) });
export const rejectProofSchema = z.object({ reason: text(300, 'reason').min(1, 'Say what to fix, for example "Short by ₱100"') });
export const markPaidSchema = z.object({
  note: text(300, 'note').min(1, 'Add a note, for example "Paid cash at the office"'),
  method: z.enum(['cash', 'other']).default('cash'),
});

export const proofSchema = z.object({
  id: z.uuid(),
  status: proofStatusSchema,
  uploadedAt: z.string(),
  fileUrl: z.string(),
  methodLabel: z.string(),
  methodAccount: z.string().nullable(),
  amountClaimed: z.number().nullable(),
  referenceNumber: z.string().nullable(),
  note: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  archived: z.boolean(),
});
export type Proof = z.infer<typeof proofSchema>;

// Slot status is worked out from the slot's active assignment (data model §7).
export const slotStateSchema = z.enum(['open', 'assigned', 'reserved']);

export const eventVendorsSchema = z.object({
  event: z.object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string(),
    status: eventStatusSchema,
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
      applicationId: z.uuid(),
      status: assignmentStatusSchema,
      slotLabel: z.string(),
      shopName: z.string(),
      phone: z.string().nullable(),
      amountDue: z.number(),
      paymentStatus: paymentStatusSchema,
      deadlineAt: z.string(),
      // Assigned, payment pending or rejected, deadline passed (spec §6.4).
      overdue: z.boolean(),
      // The latest proof, for the review panel (spec §6.3).
      proof: proofSchema.nullable(),
      paymentNote: z.string().nullable(),
    }),
  ),
  archived: z.array(
    z.object({
      assignmentId: z.uuid(),
      shopName: z.string(),
      slotLabel: z.string(),
      status: assignmentStatusSchema,
      amountDue: z.number(),
      endedAt: z.string().nullable(),
      proofs: z.array(proofSchema),
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
  // After a removal: whether the organizer lets the vendor apply again.
  canReapply: z.boolean().nullable(),
  categories: z.array(z.string()),
  documentCount: z.number().int(),
  // Proofs from earlier slots of this application, read-only.
  pastProofs: z.array(proofSchema),
  event: eventSummary.extend({
    addressLine: z.string().nullable(),
    city: z.string().nullable(),
    // Shown to vendors with a slot (spec §3.1).
    ingressInfo: z.string().nullable(),
    // Whether vendors choose a preferred slot here (spec §3.4).
    preferredSlots: z.boolean(),
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
      proofs: z.array(proofSchema),
      // Set when the organizer marked it paid without a proof.
      paymentNote: z.string().nullable(),
      archived: z.boolean(),
    })
    .nullable(),
});
export type VendorApplication = z.infer<typeof vendorApplicationSchema>;

// Remove a vendor (spec §6.6): they choose whether the vendor can reapply.
export const removeVendorSchema = z.object({
  canReapply: z.boolean(),
  note: optionalLongText(300),
});
export type RemoveVendorInput = z.input<typeof removeVendorSchema>;

// ─── Vendor dashboard (spec §4.6, mockup VendorDashboard) ───────────────────

export const vendorDashboardSchema = z.object({
  // Payments due: an assigned slot whose payment is pending or rejected.
  needsAction: z.array(
    z.object({
      applicationId: z.uuid(),
      eventName: z.string(),
      startDate: z.string().nullable(),
      slotLabel: z.string(),
      amountDue: z.number(),
      deadlineAt: z.string(),
      organizerName: z.string(),
      paidTo: z.string().nullable(),
      rejected: z.boolean(),
    }),
  ),
  applications: z.array(vendorApplicationRowSchema),
  // The next event with a reserved slot ("You're confirmed").
  nextEvent: z
    .object({
      applicationId: z.uuid(),
      event: eventSummary,
      slotLabel: z.string(),
      organizerName: z.string(),
      organizerPhone: z.string().nullable(),
      ingressInfo: z.string().nullable(),
      vendorFloorPlanUrl: z.string().nullable(),
    })
    .nullable(),
  // Events open to vendors that accept the vendor's categories.
  openEvents: z.array(z.object({ slug: z.string(), name: z.string(), startDate: z.string().nullable(), endDate: z.string().nullable(), applicationsCloseAt: z.string().nullable(), applied: z.boolean() })),
});
export type VendorDashboard = z.infer<typeof vendorDashboardSchema>;

// ─── The organizer's Applications page and detail (decided 2026-11-15) ─────

export const applicationFilterSchema = z.enum(['waiting', 'approved_no_slot', 'slot_assigned', 'reserved', 'declined', 'withdrawn', 'removed', 'all']);
export type ApplicationFilter = z.infer<typeof applicationFilterSchema>;

export const organizerApplicationsQuerySchema = z.object({
  eventId: z.uuid().optional(),
  status: applicationFilterSchema.default('waiting'),
  q: z.string().trim().max(100).optional(),
});

const slotPreference = z.object({ label: z.string(), state: preferredSlotStateSchema }).nullable();

export const applicationCardSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  eventName: z.string(),
  eventStartDate: z.string().nullable(),
  stage: vendorStatusSchema,
  shopName: z.string(),
  avatarUrl: z.string().nullable(),
  categories: z.array(z.string()),
  documents: z.object({ count: z.number().int(), pdfs: z.number().int(), missing: z.array(z.string()) }),
  submittedAt: z.string(),
  preferredSlot: slotPreference,
  slotLabel: z.string().nullable(),
});
export type ApplicationCard = z.infer<typeof applicationCardSchema>;

export const organizerApplicationsSchema = z.object({
  summary: z.object({
    waiting: z.number().int(),
    oldestWaitingAt: z.string().nullable(),
    approvedNoSlot: z.number().int(),
    openSlots: z.number().int(),
    proofsToCheck: z.number().int(),
    proofsTotal: z.number(),
  }),
  counts: z.record(applicationFilterSchema, z.number().int()),
  events: z.array(z.object({ id: z.uuid(), name: z.string(), startDate: z.string().nullable() })),
  applications: z.array(applicationCardSchema),
});
export type OrganizerApplications = z.infer<typeof organizerApplicationsSchema>;

export const applicationDetailSchema = z.object({
  id: z.uuid(),
  stage: vendorStatusSchema,
  submittedAt: z.string(),
  decidedAt: z.string().nullable(),
  decisionNote: z.string().nullable(),
  note: z.string().nullable(),
  removalNote: z.string().nullable(),
  canReapply: z.boolean().nullable(),
  policyAcceptedAt: z.string(),
  event: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    preferredSlots: z.boolean(),
    vendorFloorPlanUrl: z.string().nullable(),
  }),
  vendor: z.object({
    shopName: z.string(),
    slug: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    description: z.string().nullable(),
    products: z.string().nullable(),
    photoUrls: z.array(z.string()),
    fullName: z.string(),
    phone: z.string().nullable(),
  }),
  categories: z.array(z.object({ name: z.string(), approved: z.number().int(), max: z.number().int().nullable() })),
  documents: z.array(z.object({ id: z.uuid(), name: z.string(), url: z.string(), isPdf: z.boolean(), uploadedAt: z.string() })),
  missingDocuments: z.array(z.string()),
  preferredSlot: z
    .object({ label: z.string(), section: z.string().nullable(), sizeLabel: z.string().nullable(), price: z.number().nullable(), state: preferredSlotStateSchema, preferredByOthers: z.number().int() })
    .nullable(),
  assignment: z
    .object({ status: assignmentStatusSchema, slotLabel: z.string(), amountDue: z.number(), paymentStatus: paymentStatusSchema, deadlineAt: z.string() })
    .nullable(),
  history: z.array(z.object({ id: z.uuid(), status: z.string(), submittedAt: z.string() })),
  nextWaitingId: z.uuid().nullable(),
});
export type ApplicationDetail = z.infer<typeof applicationDetailSchema>;
