import type { ApplicationCard, ApplicationDetail, OrganizerApplications } from "@creavent/shared"

export const APP_ID = "a0000000-0000-4000-8000-000000000011"
export const NEXT_ID = "a0000000-0000-4000-8000-000000000012"
export const EVENT_A = "e0000000-0000-4000-8000-00000000000a"

export function cardFixture(overrides: Partial<ApplicationCard> = {}): ApplicationCard {
  return {
    id: APP_ID,
    eventId: EVENT_A,
    eventName: "Lanang Holiday Flea",
    eventStartDate: "2026-12-18",
    stage: "submitted",
    shopName: "Tahi-Tahi PH",
    avatarUrl: null,
    categories: ["Handmade and crafts"],
    documents: { count: 2, pdfs: 1, missing: [] },
    submittedAt: "2026-11-10T02:00:00.000Z",
    slotsRequested: 1,
    preferredSlots: [{ id: "5b000000-0000-4000-8000-000000000003", label: "B-03", state: "open" }],
    slotLabel: null,
    ...overrides,
  }
}

export function listFixture(overrides: Partial<OrganizerApplications> = {}): OrganizerApplications {
  return {
    summary: { waiting: 7, oldestWaitingAt: "2026-11-10T02:00:00.000Z", approvedNoSlot: 3, openSlots: 31, proofsToCheck: 2, proofsTotal: 2300 },
    counts: { waiting: 7, approved_no_slot: 3, slot_assigned: 4, reserved: 12, declined: 2, withdrawn: 1, removed: 1, all: 30 },
    events: [{ id: EVENT_A, name: "Lanang Holiday Flea", startDate: "2026-12-18" }],
    applications: [
      cardFixture(),
      cardFixture({ id: NEXT_ID, shopName: "Kusina ni Bea", categories: ["Food and drinks"], documents: { count: 1, pdfs: 0, missing: ["Sanitary permit"] }, preferredSlots: [] }),
    ],
    ...overrides,
  }
}

export function detailFixture(overrides: Partial<ApplicationDetail> = {}): ApplicationDetail {
  return {
    id: APP_ID,
    stage: "submitted",
    submittedAt: "2026-11-10T02:00:00.000Z",
    decidedAt: null,
    decisionNote: null,
    note: "Near the entrance if possible.",
    removalNote: null,
    canReapply: null,
    policyAcceptedAt: "2026-11-10T02:00:00.000Z",
    event: { id: EVENT_A, name: "Lanang Holiday Flea", slug: "lanang-holiday-flea", startDate: "2026-12-18", endDate: "2026-12-20", preferredSlots: true, vendorFloorPlanUrl: null },
    vendor: { shopName: "Tahi-Tahi PH", slug: "tahi-tahi-ph", avatarUrl: null, description: "Hand-embroidered pouches.", products: "Pouches, totes", photoUrls: ["https://files.test/p1.webp"], fullName: "Carla Dizon", phone: "+639181234567" },
    categories: [{ name: "Handmade and crafts", approved: 6, max: 8 }],
    documents: [
      { id: "d1", name: "Barangay business clearance", url: "/api/files/f1", isPdf: false, uploadedAt: "2026-11-10T02:00:00.000Z" },
      { id: "d2", name: "Mayor's permit", url: "/api/files/f2", isPdf: true, uploadedAt: "2026-11-10T02:00:00.000Z" },
    ],
    missingDocuments: [],
    slotsRequested: 1,
    preferredSlots: [{ id: "5b000000-0000-4000-8000-000000000003", label: "B-03", section: "Entrance", sizeLabel: "3 × 3 m", price: 1500, state: "open", preferredByOthers: 1 }],
    assignment: null,
    history: [{ id: "a-old", status: "withdrawn", submittedAt: "2026-11-01T02:00:00.000Z" }],
    nextWaitingId: NEXT_ID,
    ...overrides,
  }
}
