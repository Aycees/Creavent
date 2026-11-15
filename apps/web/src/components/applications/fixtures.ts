import type { ApplyForm, Proof, VendorApplication } from "@creavent/shared"

export const PRELOVED = "c1c1c1c1-0000-4000-8000-000000000001"
export const FOOD = "c1c1c1c1-0000-4000-8000-000000000004"
export const CLEARANCE = "d0c0d0c0-0000-4000-8000-000000000001"
export const SANITARY = "d0c0d0c0-0000-4000-8000-000000000002"

const slot = (id: string, label: string, price: number, taken = false) => ({ id, label, sizeLabel: "2 × 2 m", note: null, price, taken })

export function applyFormFixture(overrides: Partial<ApplyForm> = {}): ApplyForm {
  return {
    event: {
      slug: "lanang-holiday-flea",
      name: "Lanang Holiday Flea",
      startDate: "2026-12-18",
      endDate: "2026-12-20",
      venueName: "Damosa Gateway",
      applicationsCloseAt: "2026-12-10T23:59",
      policy: "Pay your slot fee within 24 hours of being assigned a slot.",
      deadlineHours: 24,
      preferredSlots: true,
      vendorFloorPlanUrl: null,
    },
    blocked: null,
    activeApplicationId: null,
    categories: [
      { id: PRELOVED, name: "Preloved clothing", max: 12, left: 5 },
      { id: FOOD, name: "Food and drinks", max: null, left: null },
    ],
    documents: [
      { id: CLEARANCE, name: "Barangay business clearance", description: null, categoryId: null, categoryName: null, required: true },
      { id: SANITARY, name: "Sanitary permit", description: null, categoryId: FOOD, categoryName: "Food and drinks", required: true },
    ],
    slotGroups: [
      {
        name: "Main walkway",
        slots: [slot("5a000000-0000-4000-8000-000000000001", "A-01", 800), slot("5a000000-0000-4000-8000-000000000002", "A-02", 800, true)],
      },
      { name: "Entrance", slots: [slot("5a000000-0000-4000-8000-000000000003", "B-01", 1500)] },
    ],
    ...overrides,
  }
}

export const APPLICATION_ID = "a0000000-0000-4000-8000-000000000001"

export function vendorApplicationFixture(overrides: Partial<VendorApplication> = {}): VendorApplication {
  return {
    id: APPLICATION_ID,
    status: "slot_assigned",
    submittedAt: "2026-11-03T02:00:00.000Z",
    decidedAt: "2026-11-06T02:00:00.000Z",
    decisionNote: null,
    removalNote: null,
    canReapply: null,
    categories: ["Preloved clothing"],
    documentCount: 2,
    pastProofs: [],
    event: {
      slug: "bajada-christmas-flea",
      name: "Bajada Christmas Flea",
      startDate: "2026-12-12",
      endDate: "2026-12-12",
      opensAt: "16:00",
      closesAt: "23:00",
      venueName: "Bajada Covered Court",
      addressLine: "J.P. Laurel Avenue",
      city: "Davao City",
      ingressInfo: "From 3 PM, Gate 2",
      vendorFloorPlanUrl: null,
    },
    organizer: { displayName: "Sari-Sari Collective", fullName: "Joanna Lim", phone: "0928 115 7720", contactEmail: "hello@sarisaricollective.ph", approved: true },
    preferredSlot: null,
    assignment: {
      id: "as000000-0000-4000-8000-000000000001",
      status: "assigned",
      slotLabel: "B-04",
      sizeLabel: "3 × 3 m",
      note: "Near the entrance",
      amountDue: 1500,
      assignedAt: "2026-11-12T01:00:00.000Z",
      deadlineAt: "2026-11-13T01:00:00.000Z",
      reservedAt: null,
      paymentStatus: "pending",
      instructions: [
        { id: "m0000000-0000-4000-8000-000000000001", channel: "gcash", label: "GCash", accountName: "Joanna L.", accountNumber: "0928 115 7720", qrFileId: "q0000000-0000-4000-8000-000000000001", notes: null, qrUrl: "/api/files/q1" },
        { id: "m0000000-0000-4000-8000-000000000002", channel: "bank", label: "BPI bank transfer", accountName: "Sari-Sari Collective Trading", accountNumber: "4419 0582 31", qrFileId: null, notes: null, qrUrl: null },
      ],
      proofs: [],
      paymentNote: null,
      archived: false,
    },
    ...overrides,
  }
}

export function proofFixture(overrides: Partial<Proof> = {}): Proof {
  return {
    id: "p0000000-0000-4000-8000-000000000001",
    status: "submitted",
    uploadedAt: "2026-11-12T03:00:00.000Z",
    fileUrl: "/api/files/proof1",
    methodLabel: "GCash",
    methodAccount: "0928 115 7720",
    amountClaimed: 1500,
    referenceNumber: "7012 345 678901",
    note: null,
    rejectionReason: null,
    archived: false,
    ...overrides,
  }
}
