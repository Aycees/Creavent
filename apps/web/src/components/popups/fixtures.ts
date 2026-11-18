import type { HostApproval, Popup, PopupRow } from "@creavent/shared"

// Test data for the pop-up screens.
export function hostApproval(overrides: Partial<HostApproval> = {}): HostApproval {
  return {
    status: "not_submitted",
    source: null,
    submittedAt: null,
    decidedAt: null,
    rejectionReason: null,
    revoked: false,
    suspended: false,
    socialLinks: [],
    reviewedLinks: [],
    justEarned: false,
    ...overrides,
  }
}

export const POPUP_ID = "e0000000-0000-4000-8000-000000000021"

export function popup(overrides: Partial<Popup> = {}): Popup {
  return {
    id: POPUP_ID,
    slug: "lolas-ukay-at-habi-cafe",
    status: "draft",
    details: {
      name: "Lola's Ukay at Habi Café",
      description: "Two racks of preloved tops and denim.",
      startDate: "2026-11-21",
      endDate: "2026-11-21",
      opensAt: "14:00",
      closesAt: "20:00",
      venueName: "Habi Café",
      addressLine: "Quirino Avenue, Obrero",
      city: "Davao City",
      cover: { id: "f0000000-0000-4000-8000-000000000001", url: "https://files.test/cover.webp" },
    },
    shop: { shopName: "Lola's Ukay", categories: ["Preloved clothing", "Vintage"] },
    checklist: { about: true, cover: true, schedule: true, venue: true, profile: true, host: true },
    host: hostApproval({ status: "approved", source: "reviewed" }),
    lock: null,
    hiddenByCreavent: null,
    canceled: null,
    ended: false,
    updatedAt: "2026-11-13T02:00:00.000Z",
    ...overrides,
  }
}

export function popupRow(overrides: Partial<PopupRow> = {}): PopupRow {
  return {
    id: POPUP_ID,
    slug: "lolas-ukay-at-habi-cafe",
    name: "Lola's Ukay at Habi Café",
    status: "announced",
    startDate: "2026-11-21",
    endDate: "2026-11-21",
    opensAt: "14:00",
    closesAt: "20:00",
    venueName: "Habi Café",
    hidden: false,
    nextStep: "On the events page",
    ...overrides,
  }
}
