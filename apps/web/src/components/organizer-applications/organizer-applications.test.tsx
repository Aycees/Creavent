import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { ApplicationDetailPage } from "./application-detail"
import { OrganizerApplicationsPage } from "./applications-page"
import { APP_ID, detailFixture, EVENT_A, listFixture, NEXT_ID } from "./fixtures"

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-11-15T04:00:00.000Z") })
})

describe("OrganizerApplicationsPage (/organizer/applications)", () => {
  beforeEach(() => {
    vi.mocked(api.GET).mockResolvedValue({ data: listFixture(), response: { status: 200 } } as never)
  })

  it("sums up what needs the organizer, with the oldest waiting date and proofs total", async () => {
    renderWithQuery(<OrganizerApplicationsPage />)

    const summary = await screen.findByRole("region", { name: "What needs you" })
    expect(within(summary).getByText("Waiting for your review")).toBeInTheDocument()
    expect(within(summary).getByText("Oldest from Tue, Nov 10, 5 days ago")).toBeInTheDocument()
    expect(within(summary).getByText("₱2,300 in total")).toBeInTheDocument()
  })

  it("shows each application as a card that opens its detail page", async () => {
    renderWithQuery(<OrganizerApplicationsPage />)

    const card = await screen.findByRole("article", { name: "Tahi-Tahi PH" })
    expect(within(card).getByRole("link", { name: "Tahi-Tahi PH" })).toHaveAttribute("href", `/organizer/applications/${APP_ID}`)
    expect(within(card).getByText("Lanang Holiday Flea · Fri, Dec 18")).toBeInTheDocument()
    expect(within(card).getByText("Handmade and crafts")).toBeInTheDocument()
    expect(within(card).getByText("2 documents, 1 PDF")).toBeInTheDocument()
    expect(within(card).getByText("Waiting 5 days")).toBeInTheDocument()
    expect(within(card).getByText("B-03")).toBeInTheDocument()
    const missing = screen.getByRole("article", { name: "Kusina ni Bea" })
    expect(within(missing).getByText("Sanitary permit missing")).toBeInTheDocument()
  })

  it("filters by status, event, and shop name", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQuery(<OrganizerApplicationsPage />)
    await screen.findByRole("article", { name: "Tahi-Tahi PH" })

    await user.click(screen.getByRole("button", { name: /Slot assigned/ }))
    await user.selectOptions(screen.getByLabelText("Event"), EVENT_A)
    await user.type(screen.getByRole("searchbox", { name: "Search by shop name" }), "tahi")

    await waitFor(() =>
      expect(api.GET).toHaveBeenLastCalledWith("/api/organizer/applications", { params: { query: { status: "slot_assigned", eventId: EVENT_A, q: "tahi" } } })
    )
  })

  it("says when nothing waits", async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: listFixture({ applications: [] }), response: { status: 200 } } as never)
    renderWithQuery(<OrganizerApplicationsPage />)

    expect(await screen.findByText("Nothing waiting. New applications show up here, and we email you each one.")).toBeInTheDocument()
  })
})

describe("ApplicationDetailPage (/organizer/applications/[id])", () => {
  function serve(data = detailFixture()) {
    vi.mocked(api.GET).mockResolvedValue({ data, response: { status: 200 } } as never)
  }

  it("shows the shop, documents, preferred slot, note, contact, and history", async () => {
    serve()
    renderWithQuery(<ApplicationDetailPage id={APP_ID} />)

    expect(await screen.findByRole("heading", { name: "Tahi-Tahi PH", level: 1 })).toBeInTheDocument()
    expect(screen.getByText("Waiting · 5 days")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View shop page" })).toHaveAttribute("href", "/vendors/tahi-tahi-ph")
    const docs = screen.getByRole("region", { name: "Documents" })
    expect(within(docs).getByRole("link", { name: /Barangay business clearance/ })).toHaveAttribute("href", "/api/files/f1")
    expect(within(docs).getByText("All required uploaded")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Preferred slot" })).toHaveTextContent("Also preferred by 1 other vendor")
    expect(screen.getByRole("link", { name: "Call +639181234567" })).toHaveAttribute("href", "tel:+639181234567")
    expect(screen.getByRole("link", { name: "Text" })).toHaveAttribute("href", "sms:+639181234567")
    expect(screen.getByText("Earlier: withdrew an application on Sun, Nov 1.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Next waiting/ })).toHaveAttribute("href", `/organizer/applications/${NEXT_ID}`)
  })

  it("shows a vendor asking for 2 slots with both preferred slots", async () => {
    serve(
      detailFixture({
        slotsRequested: 2,
        preferredSlots: [
          { id: "5b000000-0000-4000-8000-000000000003", label: "B-03", section: "Entrance", sizeLabel: "3 × 3 m", price: 1500, state: "open", preferredByOthers: 0 },
          { id: "5b000000-0000-4000-8000-000000000004", label: "B-04", section: "Entrance", sizeLabel: "3 × 3 m", price: 1500, state: "taken", preferredByOthers: 2 },
        ],
      })
    )
    renderWithQuery(<ApplicationDetailPage id={APP_ID} />)

    const region = await screen.findByRole("region", { name: "Preferred slots" })
    expect(region).toHaveTextContent("Wants 2 slots")
    expect(region).toHaveTextContent("B-03")
    expect(region).toHaveTextContent("B-04 · Entrance · 3 × 3 m · ₱1,500 · taken")
    expect(region).toHaveTextContent("B-04 is also preferred by 2 other vendors")
  })

  it("approves with a note from the decision panel", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    serve()
    vi.mocked(api.POST).mockResolvedValue({ data: {}, response: { status: 201 } } as never)
    renderWithQuery(<ApplicationDetailPage id={APP_ID} />)

    const panel = await screen.findByRole("region", { name: "Your decision" })
    expect(within(panel).getByText("Handmade and crafts: 6 of 8 accepted")).toBeInTheDocument()
    await user.type(within(panel).getByLabelText(/Note to the vendor/), "See you there!")
    await user.click(within(panel).getByRole("button", { name: "Approve" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events/{id}/applications/{applicationId}/approve", {
      params: { path: { id: EVENT_A, applicationId: APP_ID } },
      body: { note: "See you there!" },
    })
  })

  it("flags a missing required document", async () => {
    serve(detailFixture({ missingDocuments: ["Sanitary permit"] }))
    renderWithQuery(<ApplicationDetailPage id={APP_ID} />)

    expect(await screen.findByText("Missing: Sanitary permit")).toBeInTheDocument()
  })

  it("sends an approved vendor with no slot to Vendors and slots, and offers Remove", async () => {
    serve(detailFixture({ stage: "approved", decidedAt: "2026-11-12T02:00:00.000Z" }))
    renderWithQuery(<ApplicationDetailPage id={APP_ID} />)

    expect(await screen.findByRole("link", { name: "Assign a slot" })).toHaveAttribute("href", `/organizer/events/${EVENT_A}/vendors`)
    expect(screen.getByRole("button", { name: "Remove from this event" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Your decision" })).not.toBeInTheDocument()
  })

  it("shows the slot and payment once assigned", async () => {
    serve(detailFixture({ stage: "slot_assigned", assignment: { status: "assigned", slotLabel: "B-03", amountDue: 1500, paymentStatus: "submitted", deadlineAt: "2026-11-16T08:00:00.000Z" } }))
    renderWithQuery(<ApplicationDetailPage id={APP_ID} />)

    const slot = await screen.findByRole("region", { name: "Slot and payment" })
    expect(slot).toHaveTextContent("B-03")
    expect(slot).toHaveTextContent("₱1,500")
    expect(within(slot).getByText("Proof submitted")).toBeInTheDocument()
    expect(within(slot).getByRole("link", { name: "Review on Vendors and slots" })).toHaveAttribute("href", `/organizer/events/${EVENT_A}/vendors`)
  })

  it("lets the organizer allow a removed vendor to apply again", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    serve(detailFixture({ stage: "removed", canReapply: false, removalNote: "No payment" }))
    vi.mocked(api.POST).mockResolvedValue({ data: {}, response: { status: 201 } } as never)
    renderWithQuery(<ApplicationDetailPage id={APP_ID} />)

    await user.click(await screen.findByRole("button", { name: "Let them apply again" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events/{id}/applications/{applicationId}/reapply", {
      params: { path: { id: EVENT_A, applicationId: APP_ID } },
      body: { canReapply: true },
    })
  })

  it("says when the application isn't found", async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: undefined, response: { status: 404 } } as never)
    renderWithQuery(<ApplicationDetailPage id={APP_ID} />)

    expect(await screen.findByText("Application not found")).toBeInTheDocument()
  })
})
