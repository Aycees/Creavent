import { z } from 'zod';
import { paymentChannelSchema } from './events.js';
import { preferredSlotStateSchema } from './applications.js';

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
