import type { EventApplications, OrganizerApplication } from "@creavent/shared"

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
