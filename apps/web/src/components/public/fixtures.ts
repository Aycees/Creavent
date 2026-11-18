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
    id: "5e0c7b2a-3f4d-4c8e-9a1b-2c3d4e5f6a7b",
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
    host: null,
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

// A vendor's own pop-up (spec §4.7): a host instead of an organizer, and no
// other vendors.
export function popupEventFixture(overrides: Partial<PublicEvent> = {}): PublicEvent {
  return publicEventFixture({
    slug: "lolas-ukay-at-habi-cafe",
    name: "Lola's Ukay at Habi Café",
    typeName: "Pop-up",
    startDate: "2026-11-21",
    endDate: "2026-11-21",
    opensAt: "14:00",
    closesAt: "20:00",
    venueName: "Habi Café",
    addressLine: "Quirino Avenue, Obrero",
    publicFloorPlanUrl: null,
    organizer: null,
    host: {
      shopName: "Lola's Ukay",
      slug: "lolas-ukay",
      avatarUrl: null,
      approved: true,
      categories: ["Preloved clothing", "Vintage"],
      products: "Tops, denim, jackets, bags",
      photos: ["https://files.example/p1.webp", "https://files.example/p2.webp"],
      socialLinks: ["https://instagram.com/lolasukay"],
      joinedAt: "2026-03-02T02:00:00Z",
      eventsSoldAt: 6,
    },
    vendors: [],
    ...overrides,
  })
}

export const manyVendors = Array.from({ length: 12 }, (_, i) => vendor(`Shop ${i + 1}`, `B-${String(i + 1).padStart(2, "0")}`, ["Handmade"]))
