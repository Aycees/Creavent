import { screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { APPLICATION_ID, vendorApplicationFixture } from "./fixtures"
import { VendorDashboardPage } from "./vendor-dashboard"

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }))

const e = vendorApplicationFixture().event
const dashboard = {
  needsAction: [
    { applicationId: APPLICATION_ID, eventName: "Bajada Christmas Flea", startDate: "2026-12-12", slotLabel: "B-04", amountDue: 1500, deadlineAt: "2026-11-13T01:00:00.000Z", organizerName: "Sari-Sari Collective", paidTo: "GCash or Bank transfer", rejected: false },
  ],
  applications: [{ id: APPLICATION_ID, event: e, status: "slot_assigned", slotLabel: "B-04", amountDue: 1500, paymentStatus: "pending", deadlineAt: "2026-11-13T01:00:00.000Z", decisionNote: null }],
  nextEvent: {
    applicationId: "a0000000-0000-4000-8000-000000000009",
    event: { ...e, slug: "matina-night-flea", name: "Matina Night Flea", startDate: "2026-11-14", endDate: "2026-11-14", opensAt: "17:00", closesAt: "23:00" },
    slotLabel: "A-03",
    organizerName: "Sari-Sari Collective",
    organizerPhone: "0928 115 7720",
    ingressInfo: "From 3 PM, Gate 2",
    vendorFloorPlanUrl: "https://files.test/plan.webp",
  },
  openEvents: [{ slug: "lanang-holiday-flea", name: "Lanang Holiday Flea", startDate: "2026-12-18", endDate: "2026-12-20", applicationsCloseAt: "2026-12-10T23:59", applied: true }],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.GET).mockResolvedValue({ data: dashboard, response: { status: 200 } } as never)
})

describe("VendorDashboardPage (/vendor)", () => {
  it("leads with the payment that needs action", async () => {
    renderWithQuery(<VendorDashboardPage />)

    const action = await screen.findByRole("region", { name: "Needs your action" })
    expect(within(action).getByText("Pay ₱1,500 for slot B-04 at Bajada Christmas Flea")).toBeInTheDocument()
    expect(within(action).getByText(/Send it to Sari-Sari Collective by GCash or Bank transfer/)).toBeInTheDocument()
    expect(within(action).getByRole("link", { name: "Upload proof of payment" })).toHaveAttribute("href", `/vendor/applications/${APPLICATION_ID}`)
  })

  it("shows the applications with their status and a link to all", async () => {
    renderWithQuery(<VendorDashboardPage />)

    const apps = await screen.findByRole("region", { name: "Applications" })
    expect(within(apps).getByText("Slot assigned")).toBeInTheDocument()
    expect(within(apps).getByRole("link", { name: "See all" })).toHaveAttribute("href", "/vendor/applications")
  })

  it("shows the next confirmed event with the slot, organizer, ingress, and floor plan", async () => {
    renderWithQuery(<VendorDashboardPage />)

    const next = await screen.findByRole("region", { name: "You're confirmed" })
    expect(within(next).getByText("Matina Night Flea")).toBeInTheDocument()
    expect(within(next).getByText(/Slot A-03/)).toBeInTheDocument()
    expect(within(next).getByText("Sari-Sari Collective · 0928 115 7720")).toBeInTheDocument()
    expect(within(next).getByText("From 3 PM, Gate 2")).toBeInTheDocument()
    expect(within(next).getByRole("link", { name: "View floor plan" })).toHaveAttribute("href", "https://files.test/plan.webp")
  })

  it("lists events open to vendors in the vendor's categories", async () => {
    renderWithQuery(<VendorDashboardPage />)

    const open = await screen.findByRole("region", { name: "Open to vendors" })
    expect(within(open).getByRole("link", { name: "Lanang Holiday Flea" })).toHaveAttribute("href", "/events/lanang-holiday-flea")
    expect(within(open).getByText(/applied · closes Thu, Dec 10/)).toBeInTheDocument()
  })

  it("invites a new vendor to find events", async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: { needsAction: [], applications: [], nextEvent: null, openEvents: [] }, response: { status: 200 } } as never)
    renderWithQuery(<VendorDashboardPage />)

    expect(await screen.findByText("Nothing needs your action.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Find events to join" })).toHaveAttribute("href", "/vendor/events")
  })
})
