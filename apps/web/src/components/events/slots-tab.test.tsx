import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { EventSetupPage } from "./event-setup"
import { EVENT_ID, setupFixture } from "./fixtures"

let tab = "slots"
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(`tab=${tab}`) }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

let setup = setupFixture()
const ok = (async () => ({ data: setup, response: { status: 200 } })) as never

beforeEach(() => {
  vi.clearAllMocks()
  tab = "slots"
  setup = setupFixture()
  vi.mocked(api.GET).mockImplementation(ok)
  for (const m of [api.PUT, api.POST, api.PATCH, api.DELETE]) vi.mocked(m).mockImplementation(ok)
})

describe("Slots tab (spec §3.4)", () => {
  it("lists the slots grouped by section or prefix, with the default price where a slot has none", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    const walkway = await screen.findByRole("region", { name: /Main walkway/ })
    expect(within(walkway).getByText("A-01")).toBeInTheDocument()
    expect(within(walkway).getAllByText("₱800").length).toBeGreaterThan(0)
    expect(within(walkway).getByText("₱1,000")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: /^C/ })).toHaveTextContent("C-01")
    expect(screen.getByRole("heading", { name: "3 slots" })).toBeInTheDocument()
  })

  it("changes how slots are filled", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("radio", { name: /Vendors choose a preferred slot/ }))

    expect(api.PUT).toHaveBeenCalledWith("/api/organizer/events/{id}/slot-settings", {
      params: { path: { id: EVENT_ID } },
      body: { mode: "vendor_preference", defaultPrice: 800, vendorFloorPlanFileId: null },
    })
  })

  it("adds a row of slots and says which labels it makes", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    const row = await screen.findByRole("region", { name: "Add a row of slots" })
    await userEvent.type(within(row).getByLabelText(/Section/), "Food row")
    await userEvent.type(within(row).getByLabelText("Prefix"), "F")
    await userEvent.type(within(row).getByLabelText("From"), "01")
    await userEvent.type(within(row).getByLabelText("To"), "06")
    await userEvent.type(within(row).getByLabelText("Size"), "3 × 3 m")
    await userEvent.type(within(row).getByLabelText(/Price/), "1200")
    expect(within(row).getByText(/Adds F-01 to F-06/)).toBeInTheDocument()
    await userEvent.click(within(row).getByRole("button", { name: "Add 6 slots" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events/{id}/slots/row", {
      params: { path: { id: EVENT_ID } },
      body: { section: "Food row", prefix: "F", from: "01", to: "06", sizeLabel: "3 × 3 m", price: 1200 },
    })
  })

  it("edits a slot", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Edit A-01" }))
    const dialog = await screen.findByRole("dialog", { name: "Edit slot A-01" })
    await userEvent.type(within(dialog).getByLabelText(/Note/), "Near the entrance")
    await userEvent.click(within(dialog).getByRole("button", { name: "Save slot" }))

    expect(api.PATCH).toHaveBeenCalledWith("/api/organizer/events/{id}/slots/{slotId}", {
      params: { path: { id: EVENT_ID, slotId: "5a5a5a5a-0000-4000-8000-000000000001" } },
      body: { label: "A-01", section: "Main walkway", sizeLabel: "2 × 2 m", note: "Near the entrance", price: null },
    })
  })

  it("removes a slot", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Edit C-01" }))
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove slot" }))

    expect(api.DELETE).toHaveBeenCalledWith("/api/organizer/events/{id}/slots/{slotId}", {
      params: { path: { id: EVENT_ID, slotId: "5a5a5a5a-0000-4000-8000-000000000003" } },
    })
  })

  it("shows a taken label from the API", async () => {
    vi.mocked(api.POST).mockResolvedValue({ error: { message: "C-01 is already in your slot list" }, response: { status: 409 } } as never)
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Add a slot" }))
    const dialog = await screen.findByRole("dialog", { name: "Add a slot" })
    await userEvent.type(within(dialog).getByLabelText("Slot number"), "C-01")
    await userEvent.click(within(dialog).getByRole("button", { name: "Save slot" }))

    expect(await within(dialog).findByText("C-01 is already in your slot list")).toBeInTheDocument()
  })

  it("suggests a floor plan when vendors choose a slot without one", async () => {
    setup = setupFixture({ slots: { ...setupFixture().slots, mode: "vendor_preference" } })
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByText(/Upload your floor plan so vendors can see where each slot is/)).toBeInTheDocument()
  })
})

describe("Public floor plan tab", () => {
  it("says when shoppers see it", async () => {
    tab = "public-floor-plan"
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByText(/Shoppers see it on the event page once you announce the event/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Upload public floor plan/ })).toBeInTheDocument()
  })
})

describe("long slot runs", () => {
  it("shows the first slots of a long group, then the rest on request", async () => {
    const list = Array.from({ length: 16 }, (_, i) => ({
      id: `5a5a5a5a-0000-4000-8000-0000000000${String(i + 10)}`,
      label: `A-${String(i + 1).padStart(2, "0")}`,
      section: "Main walkway",
      sizeLabel: null,
      note: null,
      price: null,
    }))
    setup = setupFixture({ slots: { ...setupFixture().slots, list } })
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByText("A-03")).toBeInTheDocument()
    expect(screen.queryByText("A-04")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Show 13 more" }))
    expect(screen.getByText("A-16")).toBeInTheDocument()
  })
})
