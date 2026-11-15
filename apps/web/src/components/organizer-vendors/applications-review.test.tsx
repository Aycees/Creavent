import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { ApplicationsReview } from "./applications-review"
import { applicationFixture, EVENT_ID, eventApplicationsFixture } from "./fixtures"

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.GET).mockResolvedValue({ data: eventApplicationsFixture(), response: { status: 200 } } as never)
})

describe("ApplicationsReview (/organizer/events/[id]/applications)", () => {
  it("shows the category counters and the event tabs", async () => {
    renderWithQuery(<ApplicationsReview eventId={EVENT_ID} />)

    expect(await screen.findByText("Preloved clothing: 4 of 12 accepted")).toBeInTheDocument()
    expect(screen.getByText("Food and drinks: 5 of 5 accepted")).toBeInTheDocument()
    const tabs = screen.getByRole("navigation", { name: "Event" })
    expect(within(tabs).getByRole("link", { name: /Applications/ })).toHaveAttribute("aria-current", "page")
    expect(within(tabs).getByRole("link", { name: "Vendors and slots" })).toHaveAttribute("href", `/organizer/events/${EVENT_ID}/vendors`)
    expect(within(tabs).getByRole("link", { name: "Event setup" })).toHaveAttribute("href", `/organizer/events/${EVENT_ID}`)
  })

  it("lists waiting applications first, with contact number, documents, preferred slot, and note", async () => {
    renderWithQuery(<ApplicationsReview eventId={EVENT_ID} />)

    const card = await screen.findByRole("article", { name: "Lola's Ukay" })
    expect(within(card).getByRole("link", { name: "Lola's Ukay" })).toHaveAttribute("href", "/organizer/applications/a0000000-0000-4000-8000-000000000001")
    expect(within(card).getByText("+639174821093")).toBeInTheDocument()
    expect(within(card).getByRole("link", { name: /Barangay business clearance/ })).toHaveAttribute("href", "/api/files/f1")
    expect(within(card).getByText("B-03")).toBeInTheDocument()
    expect(within(card).getByText("Near other clothing stalls, please.")).toBeInTheDocument()
    expect(screen.queryByRole("article", { name: "Tahi-Tahi PH" })).not.toBeInTheDocument()
  })

  it("filters by status", async () => {
    renderWithQuery(<ApplicationsReview eventId={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: /Approved/ }))

    expect(screen.getByRole("article", { name: "Tahi-Tahi PH" })).toBeInTheDocument()
    expect(screen.queryByRole("article", { name: "Lola's Ukay" })).not.toBeInTheDocument()
  })

  it("says when a preferred slot is no longer available", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: eventApplicationsFixture({ applications: [applicationFixture({ preferredSlot: { id: "s1", label: "B-03", state: "removed" } })] }),
      response: { status: 200 },
    } as never)
    renderWithQuery(<ApplicationsReview eventId={EVENT_ID} />)

    expect(await screen.findByText("B-03 is no longer available")).toBeInTheDocument()
  })

  it("approves with an optional note", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      data: eventApplicationsFixture({ applications: [applicationFixture({ status: "approved" })] }),
      response: { status: 201 },
    } as never)
    renderWithQuery(<ApplicationsReview eventId={EVENT_ID} />)

    const card = await screen.findByRole("article", { name: "Lola's Ukay" })
    await userEvent.click(within(card).getByRole("button", { name: "Approve" }))
    const dialog = screen.getByRole("dialog", { name: "Approve Lola's Ukay?" })
    await userEvent.type(within(dialog).getByLabelText(/Note to the vendor/), "See you there!")
    await userEvent.click(within(dialog).getByRole("button", { name: "Approve" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events/{id}/applications/{applicationId}/approve", {
      params: { path: { id: EVENT_ID, applicationId: "a0000000-0000-4000-8000-000000000001" } },
      body: { note: "See you there!" },
    })
    expect(await screen.findByText("Lola's Ukay is approved. Assign them a slot on Vendors and slots.")).toBeInTheDocument()
  })

  it("declines and shows the API's reason when refused", async () => {
    vi.mocked(api.POST).mockResolvedValue({ error: { message: "This application was already decided" }, response: { status: 409 } } as never)
    renderWithQuery(<ApplicationsReview eventId={EVENT_ID} />)

    const card = await screen.findByRole("article", { name: "Lola's Ukay" })
    await userEvent.click(within(card).getByRole("button", { name: "Decline" }))
    const dialog = screen.getByRole("dialog", { name: "Decline Lola's Ukay?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Decline" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This application was already decided")
  })

  it("says when there's nothing to review", async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: eventApplicationsFixture({ applications: [] }), response: { status: 200 } } as never)
    renderWithQuery(<ApplicationsReview eventId={EVENT_ID} />)

    expect(await screen.findByText("No applications waiting. New ones show up here, and we email you each one.")).toBeInTheDocument()
  })

  it("lets the organizer allow a removed vendor to apply again", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: eventApplicationsFixture({ applications: [applicationFixture({ status: "removed", canReapply: false })] }),
      response: { status: 200 },
    } as never)
    const allowed = { data: eventApplicationsFixture({ applications: [applicationFixture({ status: "removed", canReapply: true })] }), response: { status: 201 } }
    // After the change, the server answers with the new state, refetches included.
    vi.mocked(api.POST).mockImplementation(async () => {
      vi.mocked(api.GET).mockResolvedValue({ ...allowed, response: { status: 200 } } as never)
      return allowed as never
    })
    renderWithQuery(<ApplicationsReview eventId={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: /Removed/ }))
    const card = screen.getByRole("article", { name: "Lola's Ukay" })
    expect(within(card).getByText("Can't apply again")).toBeInTheDocument()
    await userEvent.click(within(card).getByRole("button", { name: "Let them apply again" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events/{id}/applications/{applicationId}/reapply", {
      params: { path: { id: EVENT_ID, applicationId: "a0000000-0000-4000-8000-000000000001" } },
      body: { canReapply: true },
    })
    expect(await within(card).findByText("Can apply again")).toBeInTheDocument()
  })

  it("refreshes Vendors and slots and the dashboard after a decision, so they're current without a reload", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } })
    client.setQueryData(["event-vendors", EVENT_ID], { cached: true })
    client.setQueryData(["organizer-events"], { cached: true })
    vi.mocked(api.POST).mockResolvedValue({ data: eventApplicationsFixture(), response: { status: 201 } } as never)
    render(
      <QueryClientProvider client={client}>
        <ApplicationsReview eventId={EVENT_ID} />
      </QueryClientProvider>
    )

    const card = await screen.findByRole("article", { name: "Lola's Ukay" })
    await userEvent.click(within(card).getByRole("button", { name: "Approve" }))
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve" }))
    await screen.findByText(/is approved/)

    expect(client.getQueryState(["event-vendors", EVENT_ID])?.isInvalidated).toBe(true)
    expect(client.getQueryState(["organizer-events"])?.isInvalidated).toBe(true)
  })
})
