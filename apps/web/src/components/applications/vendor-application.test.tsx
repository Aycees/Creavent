import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { APPLICATION_ID, vendorApplicationFixture } from "./fixtures"
import { VendorApplicationPage, VendorApplicationsList } from "./vendor-application"

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }))

function serve(data: unknown) {
  vi.mocked(api.GET).mockResolvedValue({ data, response: { status: 200 } } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-11-12T04:00:00.000Z") })
})

describe("VendorApplicationPage (/vendor/applications/[id])", () => {
  it("shows the slot, the locked amount, and when to pay", async () => {
    serve(vendorApplicationFixture())
    renderWithQuery(<VendorApplicationPage id={APPLICATION_ID} />)

    expect(await screen.findByRole("heading", { name: "Bajada Christmas Flea" })).toBeInTheDocument()
    const slot = screen.getByRole("region", { name: "Your slot" })
    expect(within(slot).getByText("B-04")).toBeInTheDocument()
    expect(within(slot).getByText("₱1,500")).toBeInTheDocument()
    expect(within(slot).getByText("3 × 3 m, near the entrance")).toBeInTheDocument()
    expect(screen.getByText("Pay by Fri, Nov 13 · 9 AM")).toBeInTheDocument()
    expect(screen.getByText(/About 21 hours left/)).toBeInTheDocument()
  })

  it("lists the payment options with copy buttons, and the fraud notice", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    serve(vendorApplicationFixture())
    renderWithQuery(<VendorApplicationPage id={APPLICATION_ID} />)

    const pay = await screen.findByRole("region", { name: "1. Send your payment" })
    expect(within(pay).getByText("0928 115 7720")).toBeInTheDocument()
    expect(within(pay).getByRole("link", { name: "Show GCash QR code" })).toHaveAttribute("href", "/api/files/q1")
    await user.click(within(pay).getByRole("button", { name: "Copy GCash number" }))
    expect(await navigator.clipboard.readText()).toBe("0928 115 7720")
    expect(screen.getByText(/Creavent doesn't hold or guarantee payments/)).toBeInTheDocument()
  })

  it("shows the progress timeline and the organizer's contact", async () => {
    serve(vendorApplicationFixture())
    renderWithQuery(<VendorApplicationPage id={APPLICATION_ID} />)

    const steps = await screen.findByRole("list", { name: "Progress" })
    const items = within(steps).getAllByRole("listitem")
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining("Applied"),
      expect.stringContaining("Approved"),
      expect.stringContaining("Slot B-04 assigned"),
      expect.stringContaining("Pay and upload proof"),
      expect.stringContaining("Slot reserved"),
    ])
    expect(items[3]).toHaveAttribute("aria-current", "step")
    const contact = screen.getByRole("region", { name: "Organizer" })
    expect(within(contact).getByText("Joanna Lim · 0928 115 7720")).toBeInTheDocument()
    expect(within(contact).getByText("hello@sarisaricollective.ph")).toBeInTheDocument()
  })

  it("shows the preferred slot and the next step before a slot is assigned", async () => {
    serve(vendorApplicationFixture({ status: "submitted", decidedAt: null, assignment: null, preferredSlot: { label: "A-05", state: "open" } }))
    renderWithQuery(<VendorApplicationPage id={APPLICATION_ID} />)

    expect(await screen.findByText("Waiting for the organizer to review your application.")).toBeInTheDocument()
    expect(screen.getByText("Preferred slot: A-05")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "1. Send your payment" })).not.toBeInTheDocument()
  })

  it("shows the organizer's note on a declined application, with Apply again", async () => {
    serve(vendorApplicationFixture({ status: "declined", decisionNote: "Full this time", assignment: null }))
    renderWithQuery(<VendorApplicationPage id={APPLICATION_ID} />)

    expect(await screen.findByText("The organizer declined your application.")).toBeInTheDocument()
    expect(screen.getByText("Full this time")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Apply again" })).toHaveAttribute("href", "/vendor/events/bajada-christmas-flea/apply")
  })

  it("says the vendor is confirmed once the slot is reserved, with the ingress details", async () => {
    serve(vendorApplicationFixture({ status: "reserved", assignment: { ...vendorApplicationFixture().assignment!, status: "reserved", paymentStatus: "approved", reservedAt: "2026-11-12T03:00:00.000Z" } }))
    renderWithQuery(<VendorApplicationPage id={APPLICATION_ID} />)

    expect(await screen.findByText("You're confirmed. Slot B-04 is yours.")).toBeInTheDocument()
    expect(screen.getByText("From 3 PM, Gate 2")).toBeInTheDocument()
  })

  it("says when the application isn't found", async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: undefined, response: { status: 404 } } as never)
    renderWithQuery(<VendorApplicationPage id={APPLICATION_ID} />)

    expect(await screen.findByText("Application not found")).toBeInTheDocument()
  })
})

describe("VendorApplicationsList (/vendor/applications)", () => {
  it("lists each event with its status, slot, payment, and a link", async () => {
    serve({
      applications: [
        { id: APPLICATION_ID, event: vendorApplicationFixture().event, status: "slot_assigned", slotLabel: "B-04", amountDue: 1500, paymentStatus: "pending", deadlineAt: "2026-11-13T01:00:00.000Z", decisionNote: null },
      ],
    })
    renderWithQuery(<VendorApplicationsList />)

    const row = await screen.findByRole("article", { name: "Bajada Christmas Flea" })
    expect(within(row).getByText("Slot assigned")).toBeInTheDocument()
    expect(within(row).getByText("B-04 · ₱1,500")).toBeInTheDocument()
    expect(within(row).getByRole("link", { name: "Bajada Christmas Flea" })).toHaveAttribute("href", `/vendor/applications/${APPLICATION_ID}`)
  })

  it("invites the vendor to browse when there are none", async () => {
    serve({ applications: [] })
    renderWithQuery(<VendorApplicationsList />)

    expect(await screen.findByText("No applications yet.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Browse events" })).toHaveAttribute("href", "/vendor/events")
  })
})
