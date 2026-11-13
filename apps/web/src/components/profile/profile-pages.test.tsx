import type { OnboardingState } from "@creavent/shared"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { OrganizerProfileEdit } from "./organizer-profile-edit"
import { VendorProfileEdit } from "./vendor-profile-edit"

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const cat = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`
const photo = (n: number) => ({ id: `${n}${n}${n}${n}${n}${n}${n}${n}-2222-4222-8222-222222222222`, url: `https://files.test/p${n}.webp` })

const state: OnboardingState = {
  categories: [
    { id: cat(1), name: "Preloved clothing" },
    { id: cat(2), name: "Vintage" },
  ],
  phone: "+639174821093",
  avatar: null,
  vendor: {
    shopName: "Lola's Ukay",
    slug: "lolas-ukay",
    categoryIds: [cat(1)],
    description: "Preloved tops.",
    products: "Tops",
    photos: [photo(1), photo(2)],
    socialLinks: ["https://facebook.com/lolas"],
  },
  organizer: {
    displayName: "Bazaar ng Mintal",
    slug: "mintal",
    logo: null,
    city: "Davao City",
    about: "Monthly.",
    socialLinks: ["https://facebook.com/mintal", "https://instagram.com/new"],
    contactEmail: "b@example.com",
    approvalStatus: "approved",
    approvalSubmittedAt: "2026-11-01T00:00:00.000Z",
    reviewedAt: "2026-11-02T00:00:00.000Z",
    rejectionReason: null,
    reviewedLinks: ["https://facebook.com/mintal"],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.GET).mockImplementation((async (path: string) => ({
    data: path === "/api/profile/slug-available" ? { available: true } : state,
    response: { status: 200 },
  })) as never)
  vi.mocked(api.PUT).mockResolvedValue({ data: state, response: { status: 200 } } as never)
})

describe("VendorProfileEdit", () => {
  it("shows the shop profile, with Save disabled until something changes", async () => {
    renderWithQuery(<VendorProfileEdit />)

    expect(await screen.findByDisplayValue("Lola's Ukay")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Shop profile" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /View public page/ })).toHaveAttribute("href", "/vendors/lolas-ukay")
    expect(screen.getByText("No unsaved changes")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled()
  })

  it("saves the whole profile, with the photo made cover moved first", async () => {
    renderWithQuery(<VendorProfileEdit />)

    const name = await screen.findByLabelText("Shop name")
    await userEvent.clear(name)
    await userEvent.type(name, "Lola's Ukay PH")
    await userEvent.click(screen.getByRole("button", { name: "Make photo 2 the cover" }))
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(api.PUT).toHaveBeenCalledWith("/api/vendor/profile", {
      body: expect.objectContaining({
        shopName: "Lola's Ukay PH",
        slug: "lolas-ukay",
        categoryIds: [cat(1)],
        photoFileIds: [photo(2).id, photo(1).id],
        avatarFileId: null,
        socialLinks: ["https://facebook.com/lolas"],
      }),
    })
  })

  it("discards changes", async () => {
    renderWithQuery(<VendorProfileEdit />)

    const name = await screen.findByLabelText("Shop name")
    await userEvent.type(name, " extra")
    await userEvent.click(screen.getByRole("button", { name: "Discard" }))

    expect(screen.getByLabelText("Shop name")).toHaveValue("Lola's Ukay")
    expect(screen.getByText("No unsaved changes")).toBeInTheDocument()
  })

  it("says when a new page link is taken", async () => {
    vi.mocked(api.GET).mockImplementation((async (path: string) => ({
      data: path === "/api/profile/slug-available" ? { available: false } : state,
      response: { status: 200 },
    })) as never)
    renderWithQuery(<VendorProfileEdit />)

    const slug = await screen.findByLabelText("Page link")
    await userEvent.clear(slug)
    await userEvent.type(slug, "taken-shop")

    expect(await screen.findByText("This link is taken. Try another.")).toBeInTheDocument()
  })

  it("removes a photo", async () => {
    renderWithQuery(<VendorProfileEdit />)

    await userEvent.click(await screen.findByRole("button", { name: "Remove photo 1" }))
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(api.PUT).toHaveBeenCalledWith("/api/vendor/profile", {
      body: expect.objectContaining({ photoFileIds: [photo(2).id] }),
    })
  })
})

describe("OrganizerProfileEdit", () => {
  it("shows the approval and marks the links Creavent reviewed", async () => {
    renderWithQuery(<OrganizerProfileEdit />)

    expect(await screen.findByDisplayValue("Bazaar ng Mintal")).toBeInTheDocument()
    expect(screen.getAllByText("Approved by Creavent").length).toBeGreaterThan(0)
    const links = screen.getByRole("list", { name: "Your links" })
    expect(within(links).getAllByText("Reviewed")).toHaveLength(1)
  })

  it("warns that a new name goes back to review, then saves", async () => {
    renderWithQuery(<OrganizerProfileEdit />)

    const name = await screen.findByLabelText("Organizer name")
    await userEvent.clear(name)
    await userEvent.type(name, "Mintal Market")

    expect(screen.getByText(/back to review/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }))
    expect(api.PUT).toHaveBeenCalledWith("/api/organizer/profile", {
      body: expect.objectContaining({ displayName: "Mintal Market", contactEmail: "b@example.com", slug: "mintal" }),
    })
  })

  it("keeps at least one link", async () => {
    renderWithQuery(<OrganizerProfileEdit />)

    await userEvent.click(await screen.findByRole("button", { name: "Remove https://facebook.com/mintal" }))
    await userEvent.click(screen.getByRole("button", { name: "Remove https://instagram.com/new" }))
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(await screen.findByText("Keep at least one link")).toBeInTheDocument()
    expect(api.PUT).not.toHaveBeenCalled()
  })
})
