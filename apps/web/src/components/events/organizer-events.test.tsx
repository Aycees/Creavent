import type { OrganizerEventRow } from "@creavent/shared"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { OrganizerEventsList } from "./organizer-events"

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }))

const row = (overrides: Partial<OrganizerEventRow>): OrganizerEventRow => ({
  id: "e0e0e0e0-0000-4000-8000-000000000001",
  slug: "matina-night-flea-january",
  name: "Matina Night Flea, January",
  typeName: "Flea market",
  status: "draft",
  startDate: "2027-01-16",
  endDate: "2027-01-16",
  venueName: "Matina Town Square",
  slotCount: 28,
  nextStep: "Add payment details",
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.GET).mockResolvedValue({
    data: {
      upcoming: [
        row({}),
        row({ id: "e0e0e0e0-0000-4000-8000-000000000002", name: "Bajada Christmas Flea", status: "open_to_vendors", nextStep: "Applications open" }),
      ],
      past: [row({ id: "e0e0e0e0-0000-4000-8000-000000000003", name: "Matina Night Flea, October", status: "completed", nextStep: "Completed" })],
    },
    response: { status: 200 },
  } as never)
})

describe("OrganizerEventsList (spec §3.8)", () => {
  it("lists upcoming events with status, slots, and the next step", async () => {
    renderWithQuery(<OrganizerEventsList title="Dashboard" />)

    const draft = await screen.findByRole("article", { name: "Matina Night Flea, January" })
    expect(within(draft).getByText("Draft")).toBeInTheDocument()
    expect(within(draft).getByText("Flea market · Matina Town Square")).toBeInTheDocument()
    expect(within(draft).getByText("28 slots · not open to vendors yet")).toBeInTheDocument()
    expect(within(draft).getByText("Add payment details")).toBeInTheDocument()
    expect(within(draft).getByRole("link", { name: "Edit Matina Night Flea, January" })).toHaveAttribute(
      "href",
      "/organizer/events/e0e0e0e0-0000-4000-8000-000000000001"
    )
    expect(screen.getByRole("article", { name: "Bajada Christmas Flea" })).toHaveTextContent("Open to vendors")
    expect(screen.getByRole("tab", { name: /Upcoming/ })).toHaveTextContent("2")
  })

  it("shows past events on the Past tab", async () => {
    renderWithQuery(<OrganizerEventsList title="Dashboard" />)

    await userEvent.click(await screen.findByRole("tab", { name: /Past/ }))

    expect(screen.getByRole("article", { name: "Matina Night Flea, October" })).toBeInTheDocument()
  })

  it("leads to Create event", async () => {
    renderWithQuery(<OrganizerEventsList title="Dashboard" />)

    expect(await screen.findByRole("link", { name: "Create event" })).toHaveAttribute("href", "/organizer/events/new")
  })

  it("invites a first event when there are none", async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: { upcoming: [], past: [] }, response: { status: 200 } } as never)
    renderWithQuery(<OrganizerEventsList title="Dashboard" />)

    expect(await screen.findByText("No upcoming events. Create a draft to get started.")).toBeInTheDocument()
  })
})
