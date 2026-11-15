import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { APPLICATION_PAPER, APPLICATION_SPIN, EVENT_ID, eventVendorsFixture, SLOT_A05, SLOT_A09 } from "./fixtures"
import { VendorsAndSlots } from "./vendors-slots"

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.GET).mockResolvedValue({ data: eventVendorsFixture(), response: { status: 200 } } as never)
})

describe("VendorsAndSlots (/organizer/events/[id]/vendors)", () => {
  it("shows slots at a glance, with each slot's state and who prefers it", async () => {
    renderWithQuery(<VendorsAndSlots eventId={EVENT_ID} />)

    const glance = await screen.findByRole("region", { name: "Slots at a glance" })
    expect(within(glance).getByText("Reserved 1")).toBeInTheDocument()
    expect(within(glance).getByText("Overdue 1")).toBeInTheDocument()
    expect(within(glance).getByText("Open 3")).toBeInTheDocument()
    expect(within(glance).getByText("A-02, payment overdue")).toBeInTheDocument()
    expect(within(glance).getByText("A-05, open, preferred by 2 vendors")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Applications/ })).toHaveTextContent("3 new")
  })

  it("lists approved vendors with no slot, offering their preferred slot when it's open", async () => {
    renderWithQuery(<VendorsAndSlots eventId={EVENT_ID} />)

    const list = await screen.findByRole("region", { name: "Approved, no slot yet" })
    expect(within(list).getByText("2 vendors · 3 slots open")).toBeInTheDocument()
    expect(within(list).getByRole("button", { name: "Assign A-05 to Paper Bayani" })).toBeInTheDocument()
    expect(within(list).getByText("Preferred A-01 is taken")).toBeInTheDocument()
    expect(within(list).getByRole("button", { name: "Assign slot to Second Spin Records" })).toBeInTheDocument()
  })

  it("assigns the preferred slot from the dialog, with the amount and deadline", async () => {
    vi.mocked(api.POST).mockResolvedValue({ data: eventVendorsFixture({ unassigned: [] }), response: { status: 201 } } as never)
    renderWithQuery(<VendorsAndSlots eventId={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Assign A-05 to Paper Bayani" }))
    const dialog = screen.getByRole("dialog", { name: "Assign slot to Paper Bayani" })
    expect(within(dialog).getByRole("radio", { name: /A-05/ })).toHaveAttribute("aria-checked", "true")
    expect(within(dialog).queryByRole("radio", { name: /A-01/ })).not.toBeInTheDocument()
    expect(within(dialog).getByText("₱800")).toBeInTheDocument()
    expect(within(dialog).getByText(/24 hours/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Assign A-05" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events/{id}/assignments", {
      params: { path: { id: EVENT_ID } },
      body: { applicationId: APPLICATION_PAPER, slotId: SLOT_A05 },
    })
    expect(await screen.findByText("Paper Bayani got A-05. We emailed them how to pay.")).toBeInTheDocument()
  })

  it("says when the preferred slot is taken, and lets the organizer pick another", async () => {
    vi.mocked(api.POST).mockResolvedValue({ data: eventVendorsFixture(), response: { status: 201 } } as never)
    renderWithQuery(<VendorsAndSlots eventId={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Assign slot to Second Spin Records" }))
    const dialog = screen.getByRole("dialog", { name: "Assign slot to Second Spin Records" })
    expect(within(dialog).getByText("Preferred slot taken: A-01")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Assign" })).toBeDisabled()
    await userEvent.click(within(dialog).getByRole("radio", { name: /A-09/ }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Assign A-09" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events/{id}/assignments", {
      params: { path: { id: EVENT_ID } },
      body: { applicationId: APPLICATION_SPIN, slotId: SLOT_A09 },
    })
  })

  it("lists every vendor with a slot, the amount, payment, and deadline", async () => {
    renderWithQuery(<VendorsAndSlots eventId={EVENT_ID} />)

    const row = await screen.findByRole("row", { name: /Thrift Kingdom/ })
    expect(within(row).getByText("A-02")).toBeInTheDocument()
    expect(within(row).getByText("₱800")).toBeInTheDocument()
    expect(within(row).getByText("Overdue")).toBeInTheDocument()
    expect(within(screen.getByRole("row", { name: /Lola's Ukay/ })).getByText("Reserved")).toBeInTheDocument()
  })
})
