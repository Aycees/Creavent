import type { AdminEvent, AdminUser } from "@creavent/shared"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { AdminEventDetail } from "./event-detail"
import { AdminEventsList } from "./events-list"
import { AdminUserDetail } from "./user-detail"
import { AdminUsersList } from "./users-list"

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const userId = "3d4a7f3e-1b2c-4d5e-8f90-123456789abc"
const eventId = "2d4a7f3e-1b2c-4d5e-8f90-123456789abc"
const fileId = "4d4a7f3e-1b2c-4d5e-8f90-123456789abc"
const reportId = "1d4a7f3e-1b2c-4d5e-8f90-123456789abc"

const user: AdminUser = {
  id: userId,
  fullName: "Lea Tan",
  email: "megasaledvo@gmail.com",
  emailVerified: true,
  phone: "+639172204410",
  joinedAt: "2026-10-21T02:00:00.000Z",
  lastLoginAt: null,
  roles: [
    { role: "organizer", name: "Mega Sale DVO", approvalStatus: "approved", suspended: false, slug: "mega-sale-dvo", reviewedAt: "2026-10-30T02:00:00.000Z", suspendedAt: null, suspendedByName: null, suspensionReason: null, upcomingEvents: 2 },
  ],
  events: [{ id: eventId, name: "Black Friday Mega Ukay", startsAt: "2026-11-27T02:00:00.000Z", status: "announced", hidden: false, applied: 3, confirmed: 0 }],
  applications: [],
  host: null,
  popups: [],
  reports: [{ id: reportId, number: 142, reason: "scam", open: true, about: "Black Friday Mega Ukay" }],
  history: [{ at: "2026-10-21T02:00:00.000Z", text: "Joined" }],
}

// An earned pop-up host with two announced pop-ups (mockup P6AdminRevokePhone).
const host: AdminUser = {
  ...user,
  fullName: "Luz Dimaculangan",
  roles: [{ role: "vendor", name: "Lola's Ukay", approvalStatus: "approved", suspended: false, slug: "lolas-ukay", reviewedAt: "2026-10-17T02:00:00.000Z", suspendedAt: null, suspendedByName: null, suspensionReason: null, upcomingEvents: 0 }],
  events: [],
  host: { status: "approved", source: "earned", decidedAt: "2026-10-17T02:00:00.000Z", earnedFrom: "Matina Night Flea, October", rejectionReason: null, revoked: false, announcedPopups: 2 },
  popups: [{ id: eventId, name: "Lola's Ukay at Habi Café", startsAt: "2026-11-21T06:00:00.000Z", status: "announced", hidden: false }],
}

const event: AdminEvent = {
  id: eventId,
  name: "Black Friday Mega Ukay",
  slug: "black-friday-mega-ukay",
  status: "announced",
  startsAt: "2026-11-27T02:00:00.000Z",
  venueName: "NCCC Mall Victoria",
  city: "Davao City",
  hidden: false,
  moderationReason: null,
  moderatedAt: null,
  moderatedByName: null,
  isPopup: false,
  organizer: { userId, name: "Mega Sale DVO", fullName: "Lea Tan", approved: true, suspended: false },
  slots: { total: 40, assigned: 1, reserved: 0 },
  applications: [{ id: "5d4a7f3e-1b2c-4d5e-8f90-123456789abc", shopName: "Lola's Ukay", vendorUserId: userId, status: "assigned", slotLabels: ["A-04"], documents: [{ fileId, label: "Barangay clearance" }], proofs: [] }],
  openReports: { count: 2, reportId },
  history: [],
}

function serve(data: unknown) {
  vi.mocked(api.GET).mockResolvedValue({ data, response: { status: 200 } } as never)
}

beforeEach(() => vi.clearAllMocks())

// Feature 5.2: /admin/users (sitemap §6, mockup AdminUsersP5).
describe("AdminUsersList", () => {
  it("lists people with their roles and filters them", async () => {
    serve({
      items: [{ id: userId, fullName: "Jun Reyes", email: "kalye@example.com", joinedAt: "2026-08-04T02:00:00.000Z", roles: [{ role: "vendor", name: "Kalye Kicks", approvalStatus: null, suspended: true }], openReports: 1 }],
      total: 1,
      page: 1,
      pageSize: 25,
      counts: { all: 412, vendors: 371, organizers: 48, suspended: 2 },
    })
    renderWithQuery(<AdminUsersList />)

    const link = await screen.findByRole("link", { name: /Jun Reyes/ })
    expect(link).toHaveAttribute("href", `/admin/users/${userId}`)
    expect(within(link).getByText("Vendor · Kalye Kicks")).toBeInTheDocument()
    expect(within(link).getByText("Vendor suspended")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /Suspended/ }))
    expect(api.GET).toHaveBeenLastCalledWith("/api/admin/users", { params: { query: { filter: "suspended", page: 1 } } })
  })
})

// Feature 5.2: /admin/users/[id] (mockup AdminUserDetail, AdminSuspendPhone).
describe("AdminUserDetail", () => {
  it("shows contact details, roles, events and reports", async () => {
    serve(user)
    renderWithQuery(<AdminUserDetail userId={userId} />)

    expect(await screen.findByRole("heading", { level: 1, name: "Lea Tan" })).toBeInTheDocument()
    expect(screen.getByText("megasaledvo@gmail.com")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Black Friday Mega Ukay" })).toHaveAttribute("href", `/admin/events/${eventId}`)
    expect(screen.getByRole("link", { name: /RPT-0142/ })).toHaveAttribute("href", `/admin/reports/${reportId}`)
  })

  it("suspends a role with a reason, hiding upcoming events unless unticked", async () => {
    serve(user)
    vi.mocked(api.POST).mockResolvedValue({ data: user, response: { status: 200 } } as never)
    renderWithQuery(<AdminUserDetail userId={userId} />)

    await userEvent.click(await screen.findByRole("button", { name: "Suspend organizer role" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("checkbox", { name: /Also hide their 2 upcoming events/ })).toBeChecked()
    await userEvent.click(within(dialog).getByRole("button", { name: "Suspend organizer role" }))
    expect(await within(dialog).findByText("Write the reason they will see")).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText(/Reason/), "Scam reports")
    await userEvent.click(within(dialog).getByRole("button", { name: "Suspend organizer role" }))

    expect(api.POST).toHaveBeenCalledWith("/api/admin/users/{id}/roles/{role}/suspend", {
      params: { path: { id: userId, role: "organizer" } },
      body: { reason: "Scam reports", hideUpcomingEvents: true },
    })
  })

  it("shows a suspended role's reason and reinstates it", async () => {
    serve({
      ...user,
      roles: [{ ...user.roles[0]!, role: "vendor", name: "Kalye Kicks", approvalStatus: null, suspended: true, suspendedAt: "2026-11-12T02:00:00.000Z", suspendedByName: "Mika Admin", suspensionReason: "Took a deposit", upcomingEvents: 0 }],
    })
    vi.mocked(api.POST).mockResolvedValue({ data: user, response: { status: 200 } } as never)
    renderWithQuery(<AdminUserDetail userId={userId} />)

    expect(await screen.findByText(/Took a deposit/)).toBeInTheDocument()
    expect(screen.getByText(/by Mika Admin/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Reinstate vendor role" }))

    expect(api.POST).toHaveBeenCalledWith("/api/admin/users/{id}/roles/{role}/reinstate", { params: { path: { id: userId, role: "vendor" } } })
  })
})

// Feature 6.5: pop-up host approval on /admin/users/[id] (mockup P6AdminRevokePhone).
describe("AdminUserDetail for a pop-up host", () => {
  it("shows how host approval was granted and the pop-ups they host", async () => {
    serve(host)
    renderWithQuery(<AdminUserDetail userId={userId} />)

    const panel = await screen.findByRole("region", { name: "Pop-up host" })
    expect(within(panel).getByText("Approved")).toBeInTheDocument()
    expect(within(panel).getByText(/Earned Oct 17, 2026: sold at Matina Night Flea, October/)).toBeInTheDocument()
    expect(within(panel).getByText("2 announced pop-ups")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Lola's Ukay at Habi Café" })).toHaveAttribute("href", `/admin/events/${eventId}`)
    expect(screen.getByText(/Suspending the vendor role also hides their announced pop-ups/)).toBeInTheDocument()
  })

  it("revokes host approval with a reason they'll see", async () => {
    serve(host)
    vi.mocked(api.POST).mockResolvedValue({ data: { ...host, host: { ...host.host!, status: "rejected", revoked: true } }, response: { status: 200 } } as never)
    renderWithQuery(<AdminUserDetail userId={userId} />)

    await userEvent.click(await screen.findByRole("button", { name: "Revoke host approval" }))
    const dialog = await screen.findByRole("dialog", { name: "Revoke host approval for Lola's Ukay?" })
    expect(within(dialog).getByText(/Hides their 2 announced pop-ups/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Revoke and email Luz" }))
    expect(await within(dialog).findByText("Write the reason they will see")).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText(/Reason they'll see/), "The pop-up didn't take place")
    await userEvent.click(within(dialog).getByRole("button", { name: "Revoke and email Luz" }))

    expect(api.POST).toHaveBeenCalledWith("/api/admin/users/{id}/revoke-host", { params: { path: { id: userId } }, body: { reason: "The pop-up didn't take place" } })
  })

  it("links a pending host request to its review", async () => {
    serve({ ...host, host: { ...host.host!, status: "pending_review", source: null } })
    renderWithQuery(<AdminUserDetail userId={userId} />)

    const panel = await screen.findByRole("region", { name: "Pop-up host" })
    expect(within(panel).getByRole("link", { name: "Review" })).toHaveAttribute("href", `/admin/approvals/${userId}?kind=host`)
    expect(screen.queryByRole("button", { name: "Revoke host approval" })).not.toBeInTheDocument()
  })
})

// Feature 5.2: /admin/events (mockup AdminEventsP5).
describe("AdminEventsList", () => {
  it("lists events with their status, hidden ones marked", async () => {
    serve({
      items: [{ id: eventId, name: "Super Sale Weekend", startsAt: "2026-12-06T02:00:00.000Z", typeName: "Bazaar", venueName: "SM Ecoland", organizerName: "Super Sale PH", isPopup: false, status: "open_to_vendors", hidden: true, slots: 50, confirmed: 4, openReports: 0 }],
      total: 1,
      page: 1,
      pageSize: 25,
      counts: { all: 63, open: 6, announced: 9, popups: 5, reported: 2, hidden: 1, drafts: 11 },
    })
    renderWithQuery(<AdminEventsList />)

    const link = await screen.findByRole("link", { name: /Super Sale Weekend/ })
    expect(link).toHaveAttribute("href", `/admin/events/${eventId}`)
    expect(within(link).getByText("Hidden")).toBeInTheDocument()
    expect(within(link).getByText("Open to vendors")).toBeInTheDocument()
  })

  it("filters to pop-ups, each with its host", async () => {
    serve({
      items: [{ id: eventId, name: "Lola's Ukay at Habi Café", startsAt: "2026-11-21T06:00:00.000Z", typeName: "Pop-up", venueName: "Habi Café", organizerName: "Lola's Ukay", isPopup: true, status: "announced", hidden: false, slots: 0, confirmed: 0, openReports: 1 }],
      total: 1,
      page: 1,
      pageSize: 25,
      counts: { all: 63, open: 6, announced: 9, popups: 5, reported: 2, hidden: 1, drafts: 11 },
    })
    renderWithQuery(<AdminEventsList />)

    const link = await screen.findByRole("link", { name: /Lola's Ukay at Habi Café/ })
    expect(within(link).getByText(/Pop-up · host Lola's Ukay/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Pop-ups/ }))
    expect(api.GET).toHaveBeenLastCalledWith("/api/admin/events", { params: { query: { filter: "popups", page: 1 } } })
  })
})

// Feature 5.2: /admin/events/[id] (mockup AdminEventDetail).
describe("AdminEventDetail", () => {
  it("links each document to the logged file view, and the open reports", async () => {
    serve(event)
    renderWithQuery(<AdminEventDetail eventId={eventId} />)

    expect(await screen.findByRole("heading", { level: 1, name: "Black Friday Mega Ukay" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View Barangay clearance from Lola's Ukay" })).toHaveAttribute("href", `/api/files/${fileId}`)
    expect(screen.getByRole("link", { name: "2 open reports" })).toHaveAttribute("href", `/admin/reports/${reportId}`)
    expect(screen.getByText(/saved in the audit log/)).toBeInTheDocument()
  })

  it("shows a pop-up's host instead of an organizer, and no vendors or applications", async () => {
    serve({ ...event, isPopup: true, name: "Lola's Ukay at Habi Café", organizer: { userId, name: "Lola's Ukay", fullName: "Luz Dimaculangan", approved: true, suspended: false }, slots: { total: 0, assigned: 0, reserved: 0 }, applications: [] })
    renderWithQuery(<AdminEventDetail eventId={eventId} />)

    const overview = await screen.findByRole("region", { name: "Overview" })
    expect(within(overview).getByText("Host")).toBeInTheDocument()
    expect(within(overview).queryByText("Organizer")).not.toBeInTheDocument()
    expect(within(overview).getByRole("link", { name: /Lola's Ukay/ })).toHaveAttribute("href", `/admin/users/${userId}`)
    expect(screen.queryByText(/Applications/)).not.toBeInTheDocument()
    expect(screen.getByText(/emailed to the host/)).toBeInTheDocument()
  })

  it("hides the event with a reason for the organizer", async () => {
    serve(event)
    vi.mocked(api.POST).mockResolvedValue({ data: { ...event, hidden: true }, response: { status: 200 } } as never)
    renderWithQuery(<AdminEventDetail eventId={eventId} />)

    await userEvent.click(await screen.findByRole("button", { name: "Hide event" }))
    expect(await screen.findByText("Write the reason they will see")).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Reason/), "Photos match another event")
    await userEvent.click(screen.getByRole("button", { name: "Hide event" }))

    expect(api.POST).toHaveBeenCalledWith("/api/admin/events/{id}/hide", { params: { path: { id: eventId } }, body: { reason: "Photos match another event" } })
  })

  it("shows why a hidden event is hidden, and shows it again", async () => {
    serve({ ...event, hidden: true, moderationReason: "Vendors paid and the organizer stopped replying", moderatedAt: "2026-11-02T02:00:00.000Z", moderatedByName: "Mika Admin" })
    vi.mocked(api.POST).mockResolvedValue({ data: event, response: { status: 200 } } as never)
    renderWithQuery(<AdminEventDetail eventId={eventId} />)

    expect(await screen.findByText(/organizer stopped replying/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Show event again" }))

    expect(api.POST).toHaveBeenCalledWith("/api/admin/events/{id}/show", { params: { path: { id: eventId } } })
  })
})
