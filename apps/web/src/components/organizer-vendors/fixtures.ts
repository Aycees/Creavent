import type { EventApplications, EventVendors, OrganizerApplication } from "@creavent/shared"

export const EVENT_ID = "e0000000-0000-4000-8000-000000000001"
export const PRELOVED = "c1c1c1c1-0000-4000-8000-000000000001"

export function applicationFixture(overrides: Partial<OrganizerApplication> = {}): OrganizerApplication {
  return {
    id: "a0000000-0000-4000-8000-000000000001",
    status: "submitted",
    submittedAt: "2026-11-12T02:00:00.000Z",
    decidedAt: null,
    note: "Near other clothing stalls, please.",
    decisionNote: null,
    vendor: { shopName: "Lola's Ukay", slug: "lolas-ukay", fullName: "Lola Reyes", phone: "+639174821093", avatarUrl: null },
    categories: [{ id: PRELOVED, name: "Preloved clothing" }],
    documents: [{ id: "d1", name: "Barangay business clearance", url: "/api/files/f1", isPdf: true }],
    preferredSlot: { id: "s1", label: "B-03", state: "open" },
    ...overrides,
  }
}

export function eventApplicationsFixture(overrides: Partial<EventApplications> = {}): EventApplications {
  return {
    event: { id: EVENT_ID, slug: "lanang-holiday-flea", name: "Lanang Holiday Flea", status: "open_to_vendors", applicationsOpen: true, preferredSlots: true },
    counters: [
      { categoryId: PRELOVED, name: "Preloved clothing", approved: 4, max: 12 },
      { categoryId: "c1c1c1c1-0000-4000-8000-000000000004", name: "Food and drinks", approved: 5, max: 5 },
    ],
    applications: [
      applicationFixture(),
      applicationFixture({ id: "a0000000-0000-4000-8000-000000000002", status: "approved", vendor: { shopName: "Tahi-Tahi PH", slug: null, fullName: "Carla Dizon", phone: null, avatarUrl: null } }),
    ],
    ...overrides,
  }
}

const slot = (id: string, label: string, section: string, price: number, state: "open" | "assigned" | "reserved" = "open", extra = {}) => ({
  id,
  label,
  section,
  sizeLabel: section === "Entrance" ? "3 × 3 m" : "2 × 2 m",
  price,
  state,
  overdue: false,
  preferredBy: 0,
  ...extra,
})

export const APPLICATION_PAPER = "a0000000-0000-4000-8000-0000000000a1"
export const APPLICATION_SPIN = "a0000000-0000-4000-8000-0000000000a2"
export const SLOT_A05 = "5a000000-0000-4000-8000-000000000005"
export const SLOT_A09 = "5a000000-0000-4000-8000-000000000009"

export function eventVendorsFixture(overrides: Partial<EventVendors> = {}): EventVendors {
  return {
    event: { id: EVENT_ID, slug: "lanang-holiday-flea", name: "Lanang Holiday Flea", status: "open_to_vendors", applicationsOpen: true, preferredSlots: true, deadlineHours: 24, waitingApplications: 3 },
    glance: { open: 3, assigned: 1, reserved: 1, overdue: 1 },
    slots: [
      slot("5a000000-0000-4000-8000-000000000001", "A-01", "Main walkway", 800, "reserved"),
      slot("5a000000-0000-4000-8000-000000000002", "A-02", "Main walkway", 800, "assigned", { overdue: true }),
      slot(SLOT_A05, "A-05", "Main walkway", 800, "open", { preferredBy: 2 }),
      slot(SLOT_A09, "A-09", "Main walkway", 800),
      slot("5a000000-0000-4000-8000-000000000012", "B-06", "Entrance", 1500, "open"),
    ],
    unassigned: [
      { applicationId: APPLICATION_PAPER, shopName: "Paper Bayani", categories: ["Handmade and crafts"], preferredSlot: { id: SLOT_A05, label: "A-05", state: "open" } },
      { applicationId: APPLICATION_SPIN, shopName: "Second Spin Records", categories: ["Vintage"], preferredSlot: { id: "5a000000-0000-4000-8000-000000000001", label: "A-01", state: "taken" } },
    ],
    assignments: [
      { id: "as000000-0000-4000-8000-000000000001", status: "reserved", slotLabel: "A-01", shopName: "Lola's Ukay", phone: null, amountDue: 800, paymentStatus: "approved", deadlineAt: "2026-11-13T01:00:00.000Z", overdue: false, proof: null, paymentNote: null },
      { id: "as000000-0000-4000-8000-000000000002", status: "assigned", slotLabel: "A-02", shopName: "Thrift Kingdom", phone: null, amountDue: 800, paymentStatus: "pending", deadlineAt: "2026-11-11T07:00:00.000Z", overdue: true, proof: null, paymentNote: null },
      {
        id: "as000000-0000-4000-8000-000000000003",
        status: "assigned",
        slotLabel: "B-04",
        shopName: "Kalye Kicks",
        phone: null,
        amountDue: 1500,
        paymentStatus: "submitted",
        deadlineAt: "2026-11-13T01:00:00.000Z",
        overdue: false,
        paymentNote: null,
        proof: {
          id: "p0000000-0000-4000-8000-000000000001",
          status: "submitted",
          uploadedAt: "2026-11-12T03:00:00.000Z",
          fileUrl: "/api/files/proof1",
          methodLabel: "GCash, Joanna L.",
          methodAccount: "0928 115 7720",
          amountClaimed: 1500,
          referenceNumber: "7012 345 678901",
          note: null,
          rejectionReason: null,
          archived: false,
        },
      },
    ],
    ...overrides,
  }
}
