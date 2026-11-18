import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { CreatePopup } from "./create-popup"
import { hostApproval, popupRow, POPUP_ID } from "./fixtures"
import { PopupsPage } from "./popups-page"

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }))

const push = vi.fn()

function serve(data: unknown) {
  vi.mocked(api.GET).mockResolvedValue({ data, response: { status: 200 } } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ push, replace: vi.fn() } as never)
})

describe("PopupsPage (/vendor/popups)", () => {
  it("lists Upcoming and Past with status and next step, each linking to its form", async () => {
    serve({
      host: hostApproval({ status: "approved", source: "reviewed" }),
      upcoming: [popupRow(), popupRow({ id: "e0000000-0000-4000-8000-000000000022", status: "draft", startDate: null, endDate: null, opensAt: null, closesAt: null, nextStep: "Set the dates and hours" })],
      past: [popupRow({ id: "e0000000-0000-4000-8000-000000000023", status: "completed", nextStep: "Completed" })],
    })
    renderWithQuery(<PopupsPage />)

    expect(await screen.findByRole("heading", { name: "Pop-ups" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Host a pop-up" })).toHaveAttribute("href", "/vendor/popups/new")
    const upcoming = screen.getByRole("tabpanel")
    const rows = within(upcoming).getAllByRole("article")
    expect(rows).toHaveLength(2)
    expect(within(rows[0]!).getByText("Announced")).toBeInTheDocument()
    expect(within(rows[0]!).getByText("On the events page")).toBeInTheDocument()
    expect(within(rows[0]!).getByRole("link", { name: /Edit Lola's Ukay at Habi Café/ })).toHaveAttribute("href", `/vendor/popups/${POPUP_ID}`)
    expect(within(rows[1]!).getByText("Set the dates and hours")).toBeInTheDocument()
    expect(within(rows[1]!).getByRole("link", { name: /Continue/ })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Past/ })).toHaveTextContent("1")
  })

  it("says so once when the vendor was just approved by selling at an event", async () => {
    serve({ host: hostApproval({ status: "approved", source: "earned", justEarned: true }), upcoming: [], past: [] })
    renderWithQuery(<PopupsPage />)

    expect(await screen.findByText("You're approved to host pop-ups")).toBeInTheDocument()
    expect(screen.getByText(/You've sold at a Creavent event, so there's no review/)).toBeInTheDocument()
  })

  it("explains pop-ups and how to get approved when there are none yet", async () => {
    serve({ host: hostApproval(), upcoming: [], past: [] })
    renderWithQuery(<PopupsPage />)

    expect(await screen.findByRole("heading", { name: "Host your own pop-up" })).toBeInTheDocument()
    const card = screen.getByRole("region", { name: "Host approval" })
    expect(within(card).getByText("Not submitted")).toBeInTheDocument()
    expect(within(card).getByText(/You can write drafts now/)).toBeInTheDocument()
    expect(within(card).getByRole("link", { name: "Get approved" })).toHaveAttribute("href", "/vendor/host-approval")
  })

  it("marks a hidden pop-up", async () => {
    serve({ host: hostApproval({ status: "approved" }), upcoming: [popupRow({ hidden: true, nextStep: "Hidden by Creavent" })], past: [] })
    renderWithQuery(<PopupsPage />)

    const row = await screen.findByRole("article")
    expect(within(row).getByText("Hidden")).toBeInTheDocument()
  })
})

describe("CreatePopup (/vendor/popups/new)", () => {
  it("starts a draft from a name and opens its form", async () => {
    vi.mocked(api.POST).mockResolvedValue({ data: { id: POPUP_ID }, response: { status: 201 } } as never)
    renderWithQuery(<CreatePopup />)

    await userEvent.type(screen.getByLabelText("Pop-up name"), "Tahi Studio Weekend Sale")
    await userEvent.click(screen.getByRole("button", { name: "Create draft" }))

    expect(api.POST).toHaveBeenCalledWith("/api/vendor/popups", { body: { name: "Tahi Studio Weekend Sale" } })
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith(`/vendor/popups/${POPUP_ID}`))
  })

  it("needs a name", async () => {
    renderWithQuery(<CreatePopup />)

    await userEvent.click(screen.getByRole("button", { name: "Create draft" }))

    expect(await screen.findByText("Enter the event name")).toBeInTheDocument()
    expect(api.POST).not.toHaveBeenCalled()
  })
})
