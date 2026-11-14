import type { VendorEvent, VendorEventCard } from "@creavent/shared"

const organizer = { displayName: "Balik-Gamit Davao", slug: "balik-gamit", logoUrl: null, approved: true }

export const PRELOVED = "c1c1c1c1-0000-4000-8000-000000000001"

export function cardFixture(overrides: Partial<VendorEventCard> = {}): VendorEventCard {
  return {
    slug: "lanang-holiday-flea",
    name: "Lanang Holiday Flea",
    typeName: "Flea market",
    status: "open_to_vendors",
    startDate: "2026-12-18",
    endDate: "2026-12-20",
    opensAt: "15:00",
    closesAt: "23:00",
    venueName: "Damosa Gateway",
    city: "Davao City",
    coverUrl: null,
    organizer,
    feeRange: "₱800 to ₱1,500",
    applicationsCloseAt: "2026-12-10T23:59",
    acceptingApplications: true,
    preferredSlots: true,
    mySpots: [{ categoryName: "Preloved clothing", left: 5, max: 12 }],
    ...overrides,
  }
}

export function eventFixture(overrides: Partial<VendorEvent> = {}): VendorEvent {
  return {
    slug: "lanang-holiday-flea",
    name: "Lanang Holiday Flea",
    typeName: "Flea market",
    status: "open_to_vendors",
    startDate: "2026-12-18",
    endDate: "2026-12-20",
    opensAt: "15:00",
    closesAt: "23:00",
    venueName: "Damosa Gateway",
    addressLine: "Lanang",
    city: "Davao City",
    description: "Three nights of ukay-ukay.",
    coverUrl: null,
    organizer,
    applicationsCloseAt: "2026-12-10T23:59",
    acceptingApplications: true,
    categories: [
      { id: PRELOVED, name: "Preloved clothing", max: 12, left: 5 },
      { id: "c1c1c1c1-0000-4000-8000-000000000003", name: "Food and drinks", max: null, left: null },
    ],
    documents: [
      { name: "Barangay business clearance", categoryName: null },
      { name: "Sanitary permit", categoryName: "Food and drinks" },
    ],
    preferredSlots: true,
    slotGroups: [
      { name: "Main walkway", range: "A-01 to A-16", sizes: "2 × 2 m", notes: null, feeRange: "₱800", open: 9, total: 16 },
      { name: "Entrance", range: "B-01 to B-12", sizes: "3 × 3 m", notes: "Near the gate", feeRange: "₱1,500", open: 4, total: 12 },
    ],
    vendorFloorPlanUrl: null,
    policy: "Pay within 24 hours.",
    summary: { feeRange: "₱800 to ₱1,500", deadlineHours: 24, paidTo: "GCash or Bank transfer" },
    vendorContactInfo: "Rhea Montemayor · 0917 482 1093",
    myCategoryIds: [PRELOVED],
    ...overrides,
  }
}
