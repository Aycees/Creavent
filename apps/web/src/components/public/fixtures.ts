import type { PublicEvent, PublicVendorRow } from "@creavent/shared"

const vendor = (shopName: string, slotLabel: string, categories: string[], slug: string | null = shopName.toLowerCase().replace(/[^a-z]+/g, "-")): PublicVendorRow => ({
  shopName,
  slug,
  avatarUrl: null,
  categories,
  slotLabel,
})

export function publicEventFixture(overrides: Partial<PublicEvent> = {}): PublicEvent {
  return {
    slug: "matina-night-flea",
    name: "Matina Night Flea",
    typeName: "Flea market",
    status: "announced",
    startDate: "2026-11-14",
    endDate: "2026-11-14",
    opensAt: "17:00",
    closesAt: "23:00",
    venueName: "Matina Town Square",
    addressLine: "MacArthur Highway, Matina",
    city: "Davao City",
    latitude: null,
    longitude: null,
    description: "Davao's after-work flea market is back.",
    coverUrl: null,
    publicFloorPlanUrl: "https://files.example/floor.webp",
    organizer: {
      displayName: "Sari-Sari Collective",
      slug: "sari-sari-collective",
      logoUrl: null,
      approved: true,
      about: "Night markets around Matina since 2022.",
      socialLinks: ["https://facebook.com/sarisari"],
      eventsHeld: 9,
    },
    vendors: [
      vendor("Lola's Ukay", "A-03", ["Preloved clothing"]),
      vendor("Second Spin Records", "A-07", ["Vintage"]),
      vendor("Kape Kalinaw", "F-02", ["Food and drinks"], null),
    ],
    updatedAt: "2026-11-10T02:00:00Z",
    canceled: null,
    ...overrides,
  }
}

export const manyVendors = Array.from({ length: 12 }, (_, i) => vendor(`Shop ${i + 1}`, `B-${String(i + 1).padStart(2, "0")}`, ["Handmade"]))
