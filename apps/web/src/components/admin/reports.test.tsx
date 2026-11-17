import type { ReportDetail, ReportGroup } from "@creavent/shared"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { ReportReview } from "./report-review"
import { ReportsQueue } from "./reports-queue"

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const reportId = "1d4a7f3e-1b2c-4d5e-8f90-123456789abc"
const eventId = "2d4a7f3e-1b2c-4d5e-8f90-123456789abc"
const userId = "3d4a7f3e-1b2c-4d5e-8f90-123456789abc"
const push = vi.fn()

const group: ReportGroup = {
  id: reportId,
  target: { type: "event", id: eventId, name: "Black Friday Mega Ukay", subtitle: "Mega Sale DVO · announced", startsAt: "2026-11-27T02:00:00.000Z" },
  count: 2,
  reasons: ["scam", "fake_account"],
  fromEmail: true,
  oldestAt: "2026-11-10T12:12:00.000Z",
  status: "open",
  actionTaken: null,
  resolvedAt: null,
}

const eventDetail: ReportDetail = {
  id: reportId,
  status: "open",
  actionTaken: null,
  resolvedAt: null,
  resolvedByName: null,
  resolutionNote: null,
  target: { ...group.target, organizer: { userId, name: "Mega Sale DVO", suspended: false }, host: null, hidden: false, roles: [] },
  reports: [
    { number: 142, reason: "fake_account", details: "Same photos as a Cebu event.", source: "report_button", reporter: "Maria Santos (vendor, lola's ukay)", addedBy: null, createdAt: "2026-11-10T12:12:00.000Z" },
    { number: 143, reason: "scam", details: "Asked for a GCash deposit.", source: "support_email", reporter: "visitor@example.com", addedBy: "Mika Admin", createdAt: "2026-11-11T01:40:00.000Z" },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ push, replace: vi.fn() } as never)
})

function serveGroups(items: ReportGroup[], extra: Record<string, unknown> = {}) {
  vi.mocked(api.GET).mockImplementation(((path: string, init?: { params?: { query?: Record<string, string> } }) => {
    if (path === "/api/admin/search") return Promise.resolve({ data: extra.search, response: { status: 200 } })
    const status = init?.params?.query?.status ?? "open"
    const list = status === "resolved" ? ((extra.resolved as ReportGroup[]) ?? []) : items
    return Promise.resolve({ data: { items: list, openCount: items.length, resolvedCount: ((extra.resolved as ReportGroup[]) ?? []).length }, response: { status: 200 } })
  }) as never)
}

// Feature 5.1: /admin/reports (sitemap §6, mockup AdminReportsP5).
describe("ReportsQueue", () => {
  it("lists open reports grouped by what they're about, each linking to its page", async () => {
    serveGroups([group])
    renderWithQuery(<ReportsQueue />)

    const link = await screen.findByRole("link", { name: /Black Friday Mega Ukay/ })
    expect(link).toHaveAttribute("href", `/admin/reports/${reportId}`)
    expect(within(link).getByText("2 reports")).toBeInTheDocument()
    expect(within(link).getByText(/Scam, Fake account/)).toBeInTheDocument()
    expect(within(link).getByText("Email")).toBeInTheDocument()
  })

  it("shows resolved decisions under Resolved", async () => {
    serveGroups([], { resolved: [{ ...group, count: 1, status: "actioned", actionTaken: "event_hidden", resolvedAt: "2026-11-12T03:00:00.000Z" }] })
    renderWithQuery(<ReportsQueue />)

    expect(await screen.findByText("No open reports.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Resolved/ }))

    expect(await screen.findByText("Event hidden")).toBeInTheDocument()
  })

  it("adds a report from a support email", async () => {
    serveGroups([], { search: { people: [], events: [{ id: eventId, name: "Black Friday Mega Ukay", subtitle: "Mega Sale DVO · announced", startsAt: null }] } })
    vi.mocked(api.POST).mockResolvedValue({ data: { number: 144 }, response: { status: 201 } } as never)
    renderWithQuery(<ReportsQueue />)

    await userEvent.click(await screen.findByRole("button", { name: "Add report from email" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByLabelText("Sender's email"), "visitor@example.com")
    await userEvent.type(within(dialog).getByLabelText("Event"), "black")
    await userEvent.click(await within(dialog).findByRole("option", { name: /Black Friday Mega Ukay/ }))
    await userEvent.selectOptions(within(dialog).getByLabelText("Reason"), "scam")
    await userEvent.type(within(dialog).getByLabelText("What they said"), "Paid a reservation fee")
    await userEvent.click(within(dialog).getByRole("button", { name: "Add report" }))

    expect(api.POST).toHaveBeenCalledWith("/api/admin/reports", {
      body: { reporterEmail: "visitor@example.com", targetType: "event", targetId: eventId, reason: "scam", details: "Paid a reservation fee" },
    })
  })

  it("asks for what the report is about before adding it", async () => {
    serveGroups([])
    renderWithQuery(<ReportsQueue />)

    await userEvent.click(await screen.findByRole("button", { name: "Add report from email" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByLabelText("Sender's email"), "visitor@example.com")
    await userEvent.type(within(dialog).getByLabelText("What they said"), "Something")
    await userEvent.click(within(dialog).getByRole("button", { name: "Add report" }))

    expect(await within(dialog).findByText("Choose what the report is about")).toBeInTheDocument()
    expect(api.POST).not.toHaveBeenCalled()
  })
})

// Feature 5.1: /admin/reports/[id] (mockup AdminReportDetail).
describe("ReportReview", () => {
  function serve(d: ReportDetail) {
    vi.mocked(api.GET).mockResolvedValue({ data: d, response: { status: 200 } } as never)
  }

  it("shows what each person said, with its reference and source", async () => {
    serve(eventDetail)
    renderWithQuery(<ReportReview reportId={reportId} />)

    expect(await screen.findByRole("heading", { level: 1, name: "Black Friday Mega Ukay" })).toBeInTheDocument()
    expect(screen.getByText(/Same photos as a Cebu event/)).toBeInTheDocument()
    expect(screen.getByText("RPT-0142")).toBeInTheDocument()
    expect(screen.getByText(/visitor@example.com · support email, added by Mika Admin/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open event" })).toHaveAttribute("href", `/admin/events/${eventId}`)
    expect(screen.getByRole("link", { name: "Open organizer" })).toHaveAttribute("href", `/admin/users/${userId}`)
  })

  it("hides the event with a reason for the organizer and resolves the group", async () => {
    serve(eventDetail)
    vi.mocked(api.POST).mockResolvedValue({ data: { ...eventDetail, status: "actioned" }, response: { status: 200 } } as never)
    renderWithQuery(<ReportReview reportId={reportId} />)

    await userEvent.click(await screen.findByRole("radio", { name: /Hide the event/ }))
    await userEvent.click(screen.getByRole("button", { name: "Hide event and resolve 2 reports" }))
    expect(await screen.findByText("Write the reason they will see")).toBeInTheDocument()
    expect(api.POST).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText(/Reason/), "Photos match another event")
    await userEvent.type(screen.getByLabelText(/Note for the team/), "Reverse image search")
    await userEvent.click(screen.getByRole("button", { name: "Hide event and resolve 2 reports" }))

    expect(api.POST).toHaveBeenCalledWith("/api/admin/reports/{id}/resolve", {
      params: { path: { id: reportId } },
      body: { decision: "hide_event", reason: "Photos match another event", note: "Reverse image search" },
    })
    expect(push).toHaveBeenCalledWith("/admin/reports")
  })

  it("suspends the organizer from an event report, hiding their upcoming events unless unticked", async () => {
    serve(eventDetail)
    vi.mocked(api.POST).mockResolvedValue({ data: eventDetail, response: { status: 200 } } as never)
    renderWithQuery(<ReportReview reportId={reportId} />)

    await userEvent.click(await screen.findByRole("radio", { name: /Suspend the organizer role/ }))
    expect(screen.getByRole("checkbox", { name: /Also hide their upcoming events/ })).toBeChecked()
    await userEvent.type(screen.getByLabelText(/Reason/), "Scam reports")
    await userEvent.click(screen.getByRole("button", { name: "Suspend and resolve" }))

    expect(api.POST).toHaveBeenCalledWith("/api/admin/reports/{id}/resolve", {
      params: { path: { id: reportId } },
      body: { decision: "suspend_role", role: "organizer", reason: "Scam reports", note: "", hideUpcomingEvents: true },
    })
  })

  it("records a decision that's already in place", async () => {
    serve({ ...eventDetail, target: { ...eventDetail.target, hidden: true } })
    renderWithQuery(<ReportReview reportId={reportId} />)

    expect(await screen.findByRole("radio", { name: /Hide the event/ })).toBeInTheDocument()
    expect(screen.getByText(/Already hidden/)).toBeInTheDocument()
  })

  it("offers to suspend each role of a reported user", async () => {
    serve({
      ...eventDetail,
      target: { type: "user", id: userId, name: "Jun Reyes", subtitle: "Vendor, Kalye Kicks", startsAt: null, organizer: null, host: null, hidden: false, roles: [{ role: "vendor", name: "Kalye Kicks", suspended: false }] },
      reports: [eventDetail.reports[0]!],
    })
    vi.mocked(api.POST).mockResolvedValue({ data: eventDetail, response: { status: 200 } } as never)
    renderWithQuery(<ReportReview reportId={reportId} />)

    expect(await screen.findByRole("radio", { name: /Dismiss/ })).toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: /Hide the event/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("radio", { name: /Suspend the vendor role/ }))
    await userEvent.type(screen.getByLabelText(/Reason/), "Took a deposit and didn't attend")
    await userEvent.click(screen.getByRole("button", { name: "Suspend and resolve" }))

    expect(api.POST).toHaveBeenCalledWith("/api/admin/reports/{id}/resolve", {
      params: { path: { id: reportId } },
      body: { decision: "suspend_role", role: "vendor", reason: "Took a deposit and didn't attend", note: "" },
    })
  })

  it("on a pop-up, suspends the host's vendor role and offers to revoke host approval", async () => {
    const popupDetail: ReportDetail = {
      ...eventDetail,
      target: {
        type: "event",
        id: eventId,
        name: "Lola's Ukay at Habi Café",
        subtitle: "Pop-up by Lola's Ukay · announced",
        startsAt: null,
        organizer: null,
        host: { userId, name: "Lola's Ukay", suspended: false, approved: true },
        hidden: false,
        roles: [],
      },
    }
    serve(popupDetail)
    vi.mocked(api.POST).mockResolvedValue({ data: popupDetail, response: { status: 200 } } as never)
    renderWithQuery(<ReportReview reportId={reportId} />)

    expect(await screen.findByRole("link", { name: "Open host" })).toHaveAttribute("href", `/admin/users/${userId}`)
    expect(screen.getByRole("radio", { name: /Suspend the vendor role/ })).toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: /Suspend the organizer role/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("radio", { name: /Revoke host approval/ }))
    expect(screen.getByText(/hides their announced pop-ups/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Reason/), "The address was a vacant lot")
    await userEvent.click(screen.getByRole("button", { name: "Revoke and resolve" }))

    expect(api.POST).toHaveBeenCalledWith("/api/admin/reports/{id}/resolve", {
      params: { path: { id: reportId } },
      body: { decision: "revoke_host", reason: "The address was a vacant lot", note: "" },
    })
  })

  it("offers to revoke host approval on a report about an approved host", async () => {
    serve({
      ...eventDetail,
      target: { type: "user", id: userId, name: "Luz Dimaculangan", subtitle: "Vendor, Lola's Ukay", startsAt: null, organizer: null, host: { userId, name: "Lola's Ukay", suspended: false, approved: true }, hidden: false, roles: [{ role: "vendor", name: "Lola's Ukay", suspended: false }] },
    })
    renderWithQuery(<ReportReview reportId={reportId} />)

    expect(await screen.findByRole("radio", { name: /Revoke host approval/ })).toBeInTheDocument()
  })

  it("dismisses without a reason", async () => {
    serve(eventDetail)
    vi.mocked(api.POST).mockResolvedValue({ data: eventDetail, response: { status: 200 } } as never)
    renderWithQuery(<ReportReview reportId={reportId} />)

    await userEvent.click(await screen.findByRole("radio", { name: /Dismiss/ }))
    expect(screen.queryByLabelText(/Reason/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Dismiss 2 reports" }))

    expect(api.POST).toHaveBeenCalledWith("/api/admin/reports/{id}/resolve", { params: { path: { id: reportId } }, body: { decision: "dismiss", note: "" } })
  })

  it("shows a resolved decision without the form", async () => {
    serve({ ...eventDetail, status: "actioned", actionTaken: "event_hidden", resolvedAt: "2026-11-02T03:00:00.000Z", resolvedByName: "Mika Admin", resolutionNote: "Called twice" })
    renderWithQuery(<ReportReview reportId={reportId} />)

    expect(await screen.findByText(/Event hidden/)).toBeInTheDocument()
    expect(screen.getByText(/by Mika Admin on/)).toBeInTheDocument()
    expect(screen.getByText("Called twice")).toBeInTheDocument()
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()
  })
})
