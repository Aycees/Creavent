import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { EventSetupPage } from "./event-setup"
import { EVENT_ID, eventTypes, setupFixture } from "./fixtures"

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

let setup = setupFixture()

beforeEach(() => {
  vi.clearAllMocks()
  setup = setupFixture()
  vi.mocked(api.GET).mockImplementation((async () => ({ data: setup, response: { status: 200 } })) as never)
  vi.mocked(api.PUT).mockImplementation((async (_path: string, { body }: { body: unknown }) => ({
    data: { ...setup, details: { ...setup.details, ...(body as object) } },
    response: { status: 200 },
  })) as never)
})

describe("EventSetupPage header", () => {
  it("shows the name, status, type, and setup tabs", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByRole("heading", { level: 1, name: "Matina Night Flea, January" })).toBeInTheDocument()
    expect(screen.getByText("Draft")).toBeInTheDocument()
    expect(screen.getAllByText("Flea market").length).toBeGreaterThan(0)
    expect(screen.getByText("Only you can see this event.")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Details/ })).toHaveAttribute("aria-selected", "true")
  })

  it("says when the event isn't found", async () => {
    vi.mocked(api.GET).mockResolvedValue({ error: { message: "Event not found" }, response: { status: 404 } } as never)
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByText("We couldn't find this event.")).toBeInTheDocument()
  })
})

describe("Details tab", () => {
  it("shows the saved details and how vendors will see the dates", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByLabelText("Event name")).toHaveValue("Matina Night Flea, January")
    expect(screen.getByLabelText("Start date")).toHaveValue("2027-01-16")
    expect(screen.getByLabelText("Opens")).toHaveValue("17:00")
    expect(screen.getByLabelText("Venue name")).toHaveValue("Matina Town Square")
    expect(screen.getByText("Runs 1 day: Sat, Jan 16 · 5 PM to 11 PM")).toBeInTheDocument()
  })

  it("steps every time picker by 5 minutes", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByLabelText("Opens")).toHaveAttribute("step", "300")
    expect(screen.getByLabelText("Closes")).toHaveAttribute("step", "300")
    expect(screen.getByLabelText(/Applications close/)).toHaveAttribute("step", "300")
  })

  it("updates the preview for a market over several days", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    const end = await screen.findByLabelText("End date")
    await userEvent.clear(end)
    await userEvent.type(end, "2027-01-18")

    expect(screen.getByText("Runs 3 days: Sat, Jan 16 to Mon, Jan 18 · 5 PM to 11 PM daily")).toBeInTheDocument()
  })

  it("saves the details", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    const venue = await screen.findByLabelText("Venue name")
    await userEvent.clear(venue)
    await userEvent.type(venue, "Matina Covered Court")
    await userEvent.click(screen.getByRole("radio", { name: "Bazaar" }))
    await userEvent.click(screen.getByRole("button", { name: "Save details" }))

    expect(api.PUT).toHaveBeenCalledWith("/api/organizer/events/{id}/details", {
      params: { path: { id: EVENT_ID } },
      body: expect.objectContaining({ venueName: "Matina Covered Court", eventTypeId: eventTypes[1].id, startDate: "2027-01-16" }),
    })
  })

  it("refuses an event longer than 7 days before saving", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    const end = await screen.findByLabelText("End date")
    await userEvent.clear(end)
    await userEvent.type(end, "2027-01-30")
    await userEvent.click(screen.getByRole("button", { name: "Save details" }))

    expect(await screen.findByText("An event runs at most 7 days in a row")).toBeInTheDocument()
    expect(api.PUT).not.toHaveBeenCalled()
  })

  it("shows the API's field errors", async () => {
    vi.mocked(api.PUT).mockResolvedValue({
      error: { message: "Validation failed", details: [{ path: "applicationsCloseAt", message: "Close applications before the event starts" }] },
      response: { status: 400 },
    } as never)
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Save details" }))

    const field = screen.getByLabelText(/Applications close/).closest("[data-slot=field]") as HTMLElement
    expect(await within(field).findByText("Close applications before the event starts")).toBeInTheDocument()
  })
})
