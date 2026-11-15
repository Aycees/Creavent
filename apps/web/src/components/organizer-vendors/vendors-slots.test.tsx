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

    const row = await screen.findByRole("listitem", { name: "Thrift Kingdom, A-02" })
    expect(within(row).getByText("₱800")).toBeInTheDocument()
    expect(within(row).getByText("Overdue")).toBeInTheDocument()
    expect(within(screen.getByRole("listitem", { name: "Lola's Ukay, A-01" })).getByText("Reserved")).toBeInTheDocument()
  })

  it("filters the vendor list to what needs attention", async () => {
    renderWithQuery(<VendorsAndSlots eventId={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: /Needs attention/ }))

    expect(screen.getByRole("listitem", { name: "Thrift Kingdom, A-02" })).toBeInTheDocument()
    expect(screen.getByRole("listitem", { name: "Kalye Kicks, B-04" })).toBeInTheDocument()
    expect(screen.queryByRole("listitem", { name: "Lola's Ukay, A-01" })).not.toBeInTheDocument()
  })

  it("reviews a proof: the receipt, amounts, option, reference, then approves", async () => {
    vi.mocked(api.POST).mockResolvedValue({ data: eventVendorsFixture(), response: { status: 201 } } as never)
    renderWithQuery(<VendorsAndSlots eventId={EVENT_ID} />)

    const row = await screen.findByRole("listitem", { name: "Kalye Kicks, B-04" })
    await userEvent.click(within(row).getByRole("button", { name: "Review proof" }))
    const dialog = screen.getByRole("dialog", { name: "Review payment: Kalye Kicks, B-04" })
    expect(within(dialog).getByRole("link", { name: /Open the receipt/ })).toHaveAttribute("href", "/api/files/proof1")
    expect(within(dialog).getByText("GCash, Joanna L.")).toBeInTheDocument()
    expect(within(dialog).getByText("7012 345 678901")).toBeInTheDocument()
    expect(within(dialog).getByText(/Check the reference in that account's history/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Approve payment" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events/{id}/proofs/{proofId}/approve", {
      params: { path: { id: EVENT_ID, proofId: "p0000000-0000-4000-8000-000000000001" } },
      body: {},
    })
    expect(await screen.findByText("Kalye Kicks is confirmed. B-04 is reserved.")).toBeInTheDocument()
  })

  it("rejects a proof with a reason", async () => {
    vi.mocked(api.POST).mockResolvedValue({ data: eventVendorsFixture(), response: { status: 201 } } as never)
    renderWithQuery(<VendorsAndSlots eventId={EVENT_ID} />)

    await userEvent.click(within(await screen.findByRole("listitem", { name: "Kalye Kicks, B-04" })).getByRole("button", { name: "Review proof" }))
    const dialog = screen.getByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject proof" }))
    expect(within(dialog).getByText('Say what to fix, for example "Short by ₱100"')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText("What should they fix?"), "Short by ₱100")
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject proof" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events/{id}/proofs/{proofId}/reject", {
      params: { path: { id: EVENT_ID, proofId: "p0000000-0000-4000-8000-000000000001" } },
      body: { reason: "Short by ₱100" },
    })
  })

  it("marks a payment paid with a note", async () => {
    vi.mocked(api.POST).mockResolvedValue({ data: eventVendorsFixture(), response: { status: 201 } } as never)
    renderWithQuery(<VendorsAndSlots eventId={EVENT_ID} />)

    await userEvent.click(within(await screen.findByRole("listitem", { name: "Thrift Kingdom, A-02" })).getByRole("button", { name: "Mark paid" }))
    const dialog = screen.getByRole("dialog", { name: "Mark Thrift Kingdom as paid?" })
    await userEvent.type(within(dialog).getByLabelText("Note"), "Paid cash at the office")
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark paid" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events/{id}/assignments/{assignmentId}/mark-paid", {
      params: { path: { id: EVENT_ID, assignmentId: "as000000-0000-4000-8000-000000000002" } },
      body: { note: "Paid cash at the office", method: "cash" },
    })
  })

  it("removes a vendor and asks whether they can apply again", async () => {
    vi.mocked(api.POST).mockResolvedValue({ data: eventVendorsFixture(), response: { status: 201 } } as never)
    renderWithQuery(<VendorsAndSlots eventId={EVENT_ID} />)

    await userEvent.click(within(await screen.findByRole("listitem", { name: "Thrift Kingdom, A-02" })).getByRole("button", { name: "Remove" }))
    const dialog = screen.getByRole("dialog", { name: "Remove Thrift Kingdom?" })
    await userEvent.click(within(dialog).getByRole("radio", { name: "Yes, they can apply again" }))
    await userEvent.type(within(dialog).getByLabelText(/Note to the vendor/), "No payment by the deadline")
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove vendor" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events/{id}/applications/{applicationId}/remove", {
      params: { path: { id: EVENT_ID, applicationId: "a0000000-0000-4000-8000-0000000000b2" } },
      body: { canReapply: true, note: "No payment by the deadline" },
    })
    expect(await screen.findByText("Thrift Kingdom is removed. A-02 is open again.")).toBeInTheDocument()
  })
})
