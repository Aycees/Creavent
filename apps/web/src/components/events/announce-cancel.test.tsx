import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { toast } from "sonner"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { EventSetupPage } from "./event-setup"
import { EVENT_ID, setupFixture } from "./fixtures"

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn(), DELETE: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const ready = { details: true, requirements: true, policy: true, slots: true, payments: true }
let setup = setupFixture()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.GET).mockImplementation((async () => ({ data: setup, response: { status: 200 } })) as never)
})

const open = (overrides: Parameters<typeof setupFixture>[0] = {}) =>
  setupFixture({ status: "open_to_vendors", applicationsOpen: true, checklist: ready, ...overrides })

// Flow 8 (decision Q7).
describe("Announce event", () => {
  it("says what announcing shows and lists the slots still unpaid", async () => {
    setup = open({
      lineup: {
        confirmedVendors: 18,
        activeVendors: 25,
        unpaid: [
          { slotLabel: "A-02", shopName: "Kusina ni Lola", state: "overdue" },
          { slotLabel: "B-04", shopName: "Lola's Ukay", state: "proof_submitted" },
          { slotLabel: "A-11", shopName: "Paper Bayani", state: "waiting" },
        ],
      },
    })
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Announce event" }))
    const dialog = await screen.findByRole("dialog", { name: "Announce Matina Night Flea, January?" })

    expect(within(dialog).getByText(/The 18 vendors with a confirmed slot show on the event page/)).toBeInTheDocument()
    expect(within(dialog).getByText("3 slots aren't paid yet.")).toBeInTheDocument()
    expect(within(dialog).getByText("Kusina ni Lola")).toBeInTheDocument()
    expect(within(dialog).getByText("Overdue")).toBeInTheDocument()
    expect(within(dialog).getByText("Proof submitted")).toBeInTheDocument()
    expect(within(dialog).getByText("Waiting for payment")).toBeInTheDocument()
    expect(within(dialog).getByText(/No public floor plan yet/)).toBeInTheDocument()
  })

  it("announces after confirming", async () => {
    setup = open()
    vi.mocked(api.POST).mockResolvedValue({ data: { ...setup, status: "announced" }, response: { status: 201 } } as never)
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Announce event" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).queryByText(/aren't paid yet/)).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Announce event" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events/{id}/announce", { params: { path: { id: EVENT_ID } } })
    expect(await screen.findByText("Announced", { selector: "span" })).toBeInTheDocument()
  })

  it("isn't offered once the event has ended, or after it is announced", async () => {
    setup = open({ ended: true })
    const { unmount } = renderWithQuery(<EventSetupPage id={EVENT_ID} />)
    await screen.findByRole("heading", { name: "Matina Night Flea, January" })
    expect(screen.queryByRole("button", { name: "Announce event" })).not.toBeInTheDocument()
    unmount()

    setup = open({ status: "announced" })
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)
    await screen.findByRole("heading", { name: "Matina Night Flea, January" })
    expect(screen.queryByRole("button", { name: "Announce event" })).not.toBeInTheDocument()
  })
})

// Decision Q9: an announcement made by mistake can be undone for 10 minutes.
describe("Undo announce", () => {
  it("offers Undo on the confirmation, which takes the event off the listing", async () => {
    setup = open()
    const announced = { ...setup, status: "announced", undoAnnounceUntil: new Date(Date.now() + 600_000).toISOString() }
    vi.mocked(api.POST)
      .mockResolvedValueOnce({ data: announced, response: { status: 201 } } as never)
      .mockResolvedValueOnce({ data: { ...setup, status: "open_to_vendors" }, response: { status: 201 } } as never)
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Announce event" }))
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Announce event" }))
    const options = vi.mocked(toast.success).mock.calls.at(-1)![1] as { action: { label: string; onClick: () => void } }
    expect(options.action.label).toBe("Undo")
    options.action.onClick()

    await vi.waitFor(() => expect(api.POST).toHaveBeenLastCalledWith("/api/organizer/events/{id}/undo-announce", { params: { path: { id: EVENT_ID } } }))
    expect(await screen.findByRole("button", { name: "Announce event" })).toBeInTheDocument()
  })

  it("offers Undo announce in More actions while the 10 minutes last", async () => {
    setup = open({ status: "announced", undoAnnounceUntil: new Date(Date.now() + 300_000).toISOString() })
    vi.mocked(api.POST).mockResolvedValue({ data: { ...setup, status: "open_to_vendors", undoAnnounceUntil: null }, response: { status: 201 } } as never)
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "More actions" }))
    await userEvent.click(screen.getByRole("menuitem", { name: "Undo announce" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events/{id}/undo-announce", { params: { path: { id: EVENT_ID } } })
    expect(await screen.findByRole("button", { name: "Announce event" })).toBeInTheDocument()
  })

  it("doesn't offer it once the 10 minutes are over", async () => {
    setup = open({ status: "announced", undoAnnounceUntil: null })
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "More actions" }))
    expect(screen.queryByRole("menuitem", { name: "Undo announce" })).not.toBeInTheDocument()
  })
})

// Flow 9 (decisions Q4, Q6).
describe("Cancel event", () => {
  it("says who is emailed and sends the optional reason", async () => {
    setup = open({ status: "announced", lineup: { confirmedVendors: 36, activeVendors: 43, unpaid: [] } })
    vi.mocked(api.POST).mockResolvedValue({
      data: { ...setup, status: "canceled", canceled: { at: "2026-11-18T01:00:00Z", reason: "Typhoon signal 2." } },
      response: { status: 201 },
    } as never)
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "More actions" }))
    await userEvent.click(screen.getByRole("menuitem", { name: "Cancel event" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Cancel Matina Night Flea, January?" })
    expect(within(dialog).getByText("You can't undo this.")).toBeInTheDocument()
    expect(within(dialog).getByText(/We email all 43 vendors who applied or have a slot/)).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText(/Reason/), "Typhoon signal 2.")
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel event" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events/{id}/cancel", {
      params: { path: { id: EVENT_ID } },
      body: { reason: "Typhoon signal 2." },
    })
    expect(await screen.findByText(/This event is canceled/)).toBeInTheDocument()
    expect(screen.getByText("Typhoon signal 2.")).toBeInTheDocument()
  })

  it("keeps the event when the organizer changes their mind", async () => {
    setup = open()
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "More actions" }))
    await userEvent.click(screen.getByRole("menuitem", { name: "Cancel event" }))
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Keep event" }))

    expect(api.POST).not.toHaveBeenCalled()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("isn't offered on a draft, and a canceled event shows no actions", async () => {
    setup = setupFixture()
    const { unmount } = renderWithQuery(<EventSetupPage id={EVENT_ID} />)
    await screen.findByRole("heading", { name: "Matina Night Flea, January" })
    await userEvent.click(screen.getByRole("button", { name: "More actions" }))
    expect(screen.queryByRole("menuitem", { name: "Cancel event" })).not.toBeInTheDocument()
    unmount()

    setup = open({ status: "canceled", applicationsOpen: false, canceled: { at: "2026-11-18T01:00:00Z", reason: null } })
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)
    expect(await screen.findByText(/This event is canceled/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Announce event" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "More actions" }))
    expect(screen.queryByRole("menuitem", { name: "Cancel event" })).not.toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Close applications" })).not.toBeInTheDocument()
  })
})
