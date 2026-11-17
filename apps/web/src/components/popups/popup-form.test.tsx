import type { Popup } from "@creavent/shared"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { hostApproval, popup, POPUP_ID } from "./fixtures"
import { PopupEditor } from "./popup-form"

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const push = vi.fn()
const path = { params: { path: { id: POPUP_ID } } }

function serve(p: Popup) {
  vi.mocked(api.GET).mockResolvedValue({ data: p, response: { status: 200 } } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ push, replace: vi.fn() } as never)
})

describe("PopupEditor (/vendor/popups/[id])", () => {
  it("shows a draft's checklist, and leads a host who isn't approved to get approved", async () => {
    serve(
      popup({
        details: { ...popup().details, cover: null, startDate: null, endDate: null, opensAt: null, closesAt: null },
        checklist: { about: true, cover: false, schedule: false, venue: true, profile: true, host: false },
        host: hostApproval(),
      })
    )
    renderWithQuery(<PopupEditor id={POPUP_ID} />)

    expect(await screen.findByRole("heading", { level: 1, name: "Lola's Ukay at Habi Café" })).toBeInTheDocument()
    expect(screen.getByText("Only you can see this draft.")).toBeInTheDocument()
    const checklist = screen.getByRole("region", { name: "Before you announce" })
    expect(within(checklist).getByText("3 of 6 done")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Get approved to announce" })).toHaveAttribute("href", "/vendor/host-approval")
    expect(screen.queryByRole("button", { name: "Announce" })).not.toBeInTheDocument()
    expect(screen.getByText("Shows your shop: Preloved clothing, Vintage")).toBeInTheDocument()
  })

  it("saves the details", async () => {
    serve(popup())
    vi.mocked(api.PUT).mockResolvedValue({ data: popup({ details: { ...popup().details, venueName: "Habi Garden" } }), response: { status: 200 } } as never)
    renderWithQuery(<PopupEditor id={POPUP_ID} />)

    const venue = await screen.findByLabelText("Venue name")
    await userEvent.clear(venue)
    await userEvent.type(venue, "Habi Garden")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(api.PUT).toHaveBeenCalledWith("/api/vendor/popups/{id}", {
      ...path,
      body: expect.objectContaining({ name: "Lola's Ukay at Habi Café", venueName: "Habi Garden", startDate: "2026-11-21", opensAt: "14:00", city: "Davao City" }),
    })
  })

  it("announces a ready draft after a confirmation", async () => {
    serve(popup())
    vi.mocked(api.POST).mockResolvedValue({ data: popup({ status: "announced" }), response: { status: 200 } } as never)
    renderWithQuery(<PopupEditor id={POPUP_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Announce" }))
    const dialog = await screen.findByRole("dialog", { name: "Announce this pop-up?" })
    expect(within(dialog).getByText(/shows on the events page right away/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Announce pop-up" }))

    expect(api.POST).toHaveBeenCalledWith("/api/vendor/popups/{id}/announce", path)
  })

  it("shows the link to share once announced, and cancels with a note for visitors", async () => {
    serve(popup({ status: "announced" }))
    vi.mocked(api.POST).mockResolvedValue({ data: popup({ status: "canceled", canceled: { at: "2026-11-20T02:00:00.000Z", reason: "Closed" }, lock: "canceled" }), response: { status: 200 } } as never)
    renderWithQuery(<PopupEditor id={POPUP_ID} />)

    expect(await screen.findByText("Your pop-up is on the events page")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View page" })).toHaveAttribute("href", "/events/lolas-ukay-at-habi-cafe")
    await userEvent.click(screen.getByRole("button", { name: "More actions" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Cancel pop-up" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Cancel this pop-up?" })
    await userEvent.type(within(dialog).getByLabelText(/Note for visitors/), "Closed")
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel pop-up" }))

    expect(api.POST).toHaveBeenCalledWith("/api/vendor/popups/{id}/cancel", { ...path, body: { reason: "Closed" } })
  })

  it("duplicates into a new draft", async () => {
    serve(popup({ status: "completed", lock: "ended" }))
    vi.mocked(api.POST).mockResolvedValue({ data: { id: "e0000000-0000-4000-8000-000000000099" }, response: { status: 201 } } as never)
    renderWithQuery(<PopupEditor id={POPUP_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "More actions" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Duplicate" }))

    expect(api.POST).toHaveBeenCalledWith("/api/vendor/popups/{id}/duplicate", path)
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/vendor/popups/e0000000-0000-4000-8000-000000000099"))
  })

  it("deletes a draft after a confirmation", async () => {
    serve(popup())
    vi.mocked(api.DELETE).mockResolvedValue({ response: { status: 204 } } as never)
    renderWithQuery(<PopupEditor id={POPUP_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "More actions" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete draft" }))
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete draft" }))

    expect(api.DELETE).toHaveBeenCalledWith("/api/vendor/popups/{id}", path)
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/vendor/popups"))
  })

  it("locks an announced pop-up while host approval is back in review", async () => {
    serve(popup({ status: "announced", lock: "pending_review", host: hostApproval({ status: "pending_review" }) }))
    renderWithQuery(<PopupEditor id={POPUP_ID} />)

    expect(await screen.findByText("Locked while we review your shop")).toBeInTheDocument()
    expect(screen.getByLabelText("Pop-up name")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "See host approval" })).toHaveAttribute("href", "/vendor/host-approval")
  })

  it("shows why Creavent hid a pop-up, with nothing to change", async () => {
    serve(popup({ status: "announced", lock: "hidden", hiddenByCreavent: { reason: "Two visitors reported it didn't take place." } }))
    renderWithQuery(<PopupEditor id={POPUP_ID} />)

    expect(await screen.findByText("Hidden by Creavent")).toBeInTheDocument()
    expect(screen.getByText(/Two visitors reported it didn't take place/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument()
  })
})
