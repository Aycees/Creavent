import type { ApplyForm } from "@creavent/shared"

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
