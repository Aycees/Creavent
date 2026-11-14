import type { EventSetup } from "@creavent/shared"

// Test data for the event screens.
export const eventTypes = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Flea market", slug: "flea-market" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Bazaar", slug: "bazaar" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Pop-up", slug: "pop-up" },
]

export const categories = [
  { id: "c1c1c1c1-0000-4000-8000-000000000001", name: "Preloved clothing" },
  { id: "c1c1c1c1-0000-4000-8000-000000000002", name: "Vintage" },
  { id: "c1c1c1c1-0000-4000-8000-000000000003", name: "Food and drinks" },
]

export const EVENT_ID = "e0e0e0e0-0000-4000-8000-000000000001"

export function setupFixture(overrides: Partial<EventSetup> = {}): EventSetup {
  return {
    id: EVENT_ID,
    slug: "matina-night-flea-january",
    status: "draft",
    applicationsOpen: false,
    details: {
      name: "Matina Night Flea, January",
      eventTypeId: eventTypes[0].id,
      description: "Our monthly night market.",
      startDate: "2027-01-16",
      endDate: "2027-01-16",
      opensAt: "17:00",
      closesAt: "23:00",
      venueName: "Matina Town Square",
      addressLine: "MacArthur Highway, Matina",
      city: "Davao City",
      cover: null,
      vendorContactInfo: "Joanna Lim · 0928 115 7720",
      applicationsCloseAt: "2027-01-07T23:59",
      ingressInfo: "From 3 PM, Gate 2",
    },
    eventTypes,
    categories,
    requirements: {
      categories: [{ categoryId: categories[0].id, maxVendors: 12 }],
      documents: [{ id: "d0d0d0d0-0000-4000-8000-000000000001", name: "Barangay business clearance", description: null, categoryId: null }],
    },
    policy: { text: "Pay within 24 hours.", copiedFrom: { id: "e0e0e0e0-0000-4000-8000-000000000009", name: "Bajada Christmas Flea" }, example: "Example policy." },
    ...overrides,
  }
}
