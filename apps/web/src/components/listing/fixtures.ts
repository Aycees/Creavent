import type { Listing, ListingCard } from "@creavent/shared"

export const card = (name: string, startDate: string, endDate = startDate, overrides: Partial<ListingCard> = {}): ListingCard => ({
  slug: name.toLowerCase().replace(/[^a-z]+/g, "-"),
  name,
  typeName: "Flea market",
  startDate,
  endDate,
  opensAt: "17:00",
  closesAt: "23:00",
  venueName: "Matina Town Square",
  city: "Davao City",
  coverUrl: null,
  organizer: { displayName: "Sari-Sari Collective", approved: true },
  isPopup: false,
  ...overrides,
})

// Today is Thu, Nov 12, 2026.
export function listingFixture(overrides: Partial<Listing> = {}): Listing {
  return {
    tags: ["listing"],
    today: "2026-11-12",
    events: [
      card("Matina Night Flea", "2026-11-14"),
      card("Pasalubong and Handmade Fair", "2026-11-20", "2026-11-22", { typeName: "Bazaar" }),
      card("Paskong Ukay Night", "2026-12-05", "2026-12-05", { organizer: { displayName: "Tiangge Davao", approved: false } }),
    ],
    types: [
      { slug: "flea-market", name: "Flea market", count: 2 },
      { slug: "bazaar", name: "Bazaar", count: 1 },
      { slug: "pop-up", name: "Pop-up", count: 0 },
    ],
    cities: ["Davao City"],
    next7: [
      { date: "2026-11-12", count: 0 },
      { date: "2026-11-13", count: 0 },
      { date: "2026-11-14", count: 1 },
      { date: "2026-11-15", count: 0 },
      { date: "2026-11-16", count: 0 },
      { date: "2026-11-17", count: 0 },
      { date: "2026-11-18", count: 0 },
    ],
    openToVendors: 12,
    ...overrides,
  }
}
