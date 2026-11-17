import type { PublicOrganizerPage, PublicVendorPage } from "@creavent/shared"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { card } from "../listing/fixtures"
import { OrganizerPageView } from "./organizer-page"
import { VendorPageView } from "./vendor-page"

const SUPPORT = "support@creavent.example"

const organizerPage = (overrides: Partial<PublicOrganizerPage> = {}): PublicOrganizerPage => ({
  tags: [],
  organizer: {
    id: "6e0c7b2a-3f4d-4c8e-9a1b-2c3d4e5f6a7b",
    displayName: "Sari-Sari Collective",
    slug: "sari-sari-collective",
    logoUrl: null,
    approved: true,
    about: "Night markets around Matina since 2022.",
    city: "Davao City",
    socialLinks: ["https://facebook.com/sarisari", "javascript:alert(1)"],
    joinedAt: "2025-03-04T00:00:00Z",
    eventsHeld: 9,
  },
  upcoming: [card("Matina Night Flea", "2026-11-14")],
  past: [
    {
      slug: "matina-october",
      name: "Matina Night Flea, October",
      typeName: "Flea market",
      startDate: "2026-10-17",
      endDate: "2026-10-17",
      opensAt: "17:00",
      closesAt: "23:00",
      venueName: "Matina Town Square",
    },
  ],
  ...overrides,
})

// Feature 4.4 (spec §7.1, mockup OrganizerP4).
describe("OrganizerPageView", () => {
  it("shows the profile, the seal, and the counts", () => {
    render(<OrganizerPageView page={organizerPage()} supportEmail={SUPPORT} />)

    expect(screen.getByRole("heading", { level: 1, name: "Sari-Sari Collective" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Approved by Creavent/ })).toHaveAttribute("href", "/approved")
    expect(screen.getByText("Night markets around Matina since 2022.")).toBeInTheDocument()
    expect(screen.getByText("On Creavent since March 2025")).toBeInTheDocument()
    expect(screen.getByText("9")).toBeInTheDocument()
  })

  it("links only to safe social links", () => {
    render(<OrganizerPageView page={organizerPage()} supportEmail={SUPPORT} />)

    expect(screen.getByRole("link", { name: /facebook\.com\/sarisari/ })).toHaveAttribute("href", "https://facebook.com/sarisari")
    expect(screen.queryByRole("link", { name: /alert/ })).not.toBeInTheDocument()
  })

  it("lists upcoming and past events, each linking to its page", () => {
    render(<OrganizerPageView page={organizerPage()} supportEmail={SUPPORT} />)

    expect(within(screen.getByRole("region", { name: "Upcoming" })).getByRole("link", { name: /Matina Night Flea/ })).toHaveAttribute(
      "href",
      "/events/matina-night-flea",
    )
    expect(within(screen.getByRole("region", { name: "Past events" })).getByRole("link", { name: /October/ })).toHaveAttribute("href", "/events/matina-october")
  })

  it("says when there's nothing coming up, and leaves out an empty past", () => {
    render(<OrganizerPageView page={organizerPage({ upcoming: [], past: [] })} supportEmail={SUPPORT} />)

    expect(screen.getByText("No upcoming events announced yet.")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Past events" })).not.toBeInTheDocument()
  })

  it("shows no seal while the organizer isn't approved", () => {
    render(
      <OrganizerPageView
        page={organizerPage({
          organizer: { ...organizerPage().organizer, approved: false },
        })}
        supportEmail={SUPPORT}
      />,
    )

    expect(screen.queryByText(/Approved by Creavent/)).not.toBeInTheDocument()
  })
})

const vendorPage = (overrides: Partial<PublicVendorPage> = {}): PublicVendorPage => ({
  tags: [],
  vendor: {
    id: "7e0c7b2a-3f4d-4c8e-9a1b-2c3d4e5f6a7b",
    shopName: "Lola's Ukay",
    slug: "lolas-ukay",
    avatarUrl: null,
    categories: ["Preloved clothing", "Vintage"],
    description: "Hand-picked preloved tops and denim.",
    products: "Tops, denim, jackets, bags",
    city: "Davao City",
    socialLinks: ["https://instagram.com/lolasukay"],
    photos: ["https://files.example/1.webp", "https://files.example/2.webp"],
    joinedAt: "2026-03-01T00:00:00Z",
    eventsSoldAt: 2,
  },
  next: { event: card("Matina Night Flea", "2026-11-14"), slotLabel: "A-03" },
  sold: [
    {
      slug: "matina-night-flea",
      name: "Matina Night Flea",
      typeName: "Flea market",
      startDate: "2026-11-14",
      endDate: "2026-11-14",
      opensAt: "17:00",
      closesAt: "23:00",
      venueName: "Matina Town Square",
      organizerName: "Sari-Sari Collective",
      slotLabel: "A-03",
      upcoming: true,
    },
    {
      slug: "matina-october",
      name: "Matina Night Flea, October",
      typeName: "Flea market",
      startDate: "2026-10-17",
      endDate: "2026-10-17",
      opensAt: "17:00",
      closesAt: "23:00",
      venueName: "Matina Town Square",
      organizerName: "Sari-Sari Collective",
      slotLabel: "A-03",
      upcoming: false,
    },
  ],
  ...overrides,
})

// Feature 4.5 (spec §7.2, mockup VendorP4).
describe("VendorPageView", () => {
  it("shows the shop, its categories, products, and photos", () => {
    render(<VendorPageView page={vendorPage()} supportEmail={SUPPORT} />)

    expect(screen.getByRole("heading", { level: 1, name: "Lola's Ukay" })).toBeInTheDocument()
    expect(screen.getByText("Preloved clothing")).toBeInTheDocument()
    expect(screen.getByText("Tops, denim, jackets, bags")).toBeInTheDocument()
    expect(screen.getByText(/Since March 2026/)).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "From the stall" })).getAllByRole("img")).toHaveLength(2)
  })

  it("shows where to find them next, with the slot", () => {
    render(<VendorPageView page={vendorPage()} supportEmail={SUPPORT} />)

    const next = screen.getByRole("region", { name: "Find them next at" })
    expect(within(next).getByText("Matina Night Flea")).toBeInTheDocument()
    expect(within(next).getByText("A-03")).toBeInTheDocument()
    expect(within(next).getByRole("link", { name: "See event and floor plan" })).toHaveAttribute("href", "/events/matina-night-flea")
  })

  it("lists where they've sold, marking upcoming ones", () => {
    render(<VendorPageView page={vendorPage()} supportEmail={SUPPORT} />)

    const sold = screen.getByRole("region", { name: "Where they've sold" })
    expect(within(sold).getAllByRole("link")).toHaveLength(2)
    expect(within(sold).getByText("Upcoming")).toBeInTheDocument()
  })

  it("shows the profile only for a vendor with no events yet (flow 10)", () => {
    render(
      <VendorPageView
        page={vendorPage({
          next: null,
          sold: [],
          vendor: { ...vendorPage().vendor, eventsSoldAt: 0, photos: [] },
        })}
        supportEmail={SUPPORT}
      />,
    )

    expect(screen.queryByRole("region", { name: "Find them next at" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Where they've sold" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "From the stall" })).not.toBeInTheDocument()
  })
})
