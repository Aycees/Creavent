import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { APPLICATION_ID, applyFormFixture } from "./fixtures"
import { PickSlotPage } from "./pick-slot"

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn() } }))

const push = vi.fn()
const groups = applyFormFixture().slotGroups

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ push } as never)
})

function serve(currentSlotLabel: string | null, slotsRequested = 1) {
  vi.mocked(api.GET).mockResolvedValue({
    data: { currentSlotLabel, slotsRequested, preferredSlotIds: [], vendorFloorPlanUrl: null, slotGroups: groups },
    response: { status: 200 },
  } as never)
}

describe("PickSlotPage (/vendor/applications/[id]/slot)", () => {
  it("swaps an unpaid slot for the new pick", async () => {
    serve("A-01")
    vi.mocked(api.POST).mockResolvedValue({ data: {}, response: { status: 201 } } as never)
    renderWithQuery(<PickSlotPage id={APPLICATION_ID} />)

    expect(await screen.findByRole("button", { name: "A-02, taken" })).toBeDisabled()
    await userEvent.click(screen.getByRole("button", { name: "B-01, open" }))
    await userEvent.click(screen.getByRole("button", { name: "Release A-01 and pick B-01" }))

    expect(api.POST).toHaveBeenCalledWith("/api/vendor/applications/{id}/change-slot", {
      params: { path: { id: APPLICATION_ID } },
      body: { preferredSlotIds: ["5a000000-0000-4000-8000-000000000003"] },
    })
    expect(push).toHaveBeenCalledWith(`/vendor/applications/${APPLICATION_ID}`)
  })

  it("changes the preference when no slot is assigned yet", async () => {
    serve(null)
    vi.mocked(api.PUT).mockResolvedValue({ data: {}, response: { status: 200 } } as never)
    renderWithQuery(<PickSlotPage id={APPLICATION_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "B-01, open" }))
    await userEvent.click(screen.getByRole("button", { name: "Prefer B-01" }))

    expect(api.PUT).toHaveBeenCalledWith("/api/vendor/applications/{id}/preference", {
      params: { path: { id: APPLICATION_ID } },
      body: { preferredSlotIds: ["5a000000-0000-4000-8000-000000000003"] },
    })
  })

  it("swaps several unpaid slots for up to as many new picks", async () => {
    serve("C-01, C-02", 2)
    vi.mocked(api.POST).mockResolvedValue({ data: {}, response: { status: 201 } } as never)
    renderWithQuery(<PickSlotPage id={APPLICATION_ID} />)

    expect(await screen.findByRole("heading", { name: "Pick other slots" })).toBeInTheDocument()
    expect(screen.getByText(/C-01 and C-02 open for others together/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "A-01, open" }))
    await userEvent.click(screen.getByRole("button", { name: "B-01, open" }))
    expect(screen.getByText(/₱2,300/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Release both and pick A-01, B-01" }))

    expect(api.POST).toHaveBeenCalledWith("/api/vendor/applications/{id}/change-slot", {
      params: { path: { id: APPLICATION_ID } },
      body: { preferredSlotIds: ["5a000000-0000-4000-8000-000000000001", "5a000000-0000-4000-8000-000000000003"] },
    })
  })

  it("shows the API's reason when the change is refused", async () => {
    serve("A-01")
    vi.mocked(api.POST).mockResolvedValue({ error: { message: "Your payment is approved, so contact the organizer to change slots" }, response: { status: 409 } } as never)
    renderWithQuery(<PickSlotPage id={APPLICATION_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "B-01, open" }))
    await userEvent.click(screen.getByRole("button", { name: "Release A-01 and pick B-01" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Your payment is approved")
  })
})
