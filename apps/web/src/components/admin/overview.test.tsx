import type { ApprovalQueueItem, ReportGroup } from "@creavent/shared"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { AdminOverview } from "./overview"
import { AdminSearch } from "./admin-search"

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }))

const id = (n: number) => `${n}d4a7f3e-1b2c-4d5e-8f90-123456789abc`
const waiting = (n: number, over: number, resubmission = false): ApprovalQueueItem => ({
  userId: id(n),
  displayName: `Organizer ${n}`,
  city: "Davao City",
  linksCount: 2,
  submittedAt: "2026-11-09T02:00:00.000Z",
  resubmission,
  businessDaysWaiting: 2 + over,
  daysOverTarget: over,
})
const group: ReportGroup = {
  id: id(9),
  target: { type: "event", id: id(8), name: "Black Friday Mega Ukay", subtitle: "Mega Sale DVO · announced", startsAt: null },
  count: 2,
  reasons: ["scam"],
  fromEmail: false,
  oldestAt: "2026-11-10T02:00:00.000Z",
  status: "open",
  actionTaken: null,
  resolvedAt: null,
}

beforeEach(() => vi.clearAllMocks())

// Feature 5.3: /admin (sitemap §6, mockup AdminOverviewP5).
describe("AdminOverview", () => {
  it("counts organizers waiting, over the target, resubmissions, and open reports, then lists both queues", async () => {
    vi.mocked(api.GET).mockImplementation(((path: string) =>
      Promise.resolve(
        path === "/api/admin/approvals"
          ? { data: { items: [waiting(1, 1), waiting(2, 0, true), waiting(3, 2)] }, response: { status: 200 } }
          : { data: { items: [group], openCount: 1, resolvedCount: 0 }, response: { status: 200 } },
      )) as never)
    renderWithQuery(<AdminOverview />)

    const waitingCard = await screen.findByRole("link", { name: /Organizers waiting/ })
    expect(within(waitingCard).getByText("3")).toBeInTheDocument()
    expect(within(waitingCard).getByText("2 over target")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Resubmissions/ })).getByText("1")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Open reports/ })).getByText("1")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Organizer 1/ })).toHaveAttribute("href", `/admin/approvals/${id(1)}`)
    expect(screen.getByRole("link", { name: /Black Friday Mega Ukay/ })).toHaveAttribute("href", `/admin/reports/${id(9)}`)
  })
})

// Feature 5.3: the admin header search (sitemap §5).
describe("AdminSearch", () => {
  it("finds people and events and links to their pages", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: {
        people: [{ id: id(1), name: "Lea Tan", email: "lea@example.com", subtitle: "Organizer, Mega Sale DVO", suspended: false }],
        events: [{ id: id(2), name: "Black Friday Mega Ukay", subtitle: "Mega Sale DVO · announced", startsAt: null }],
      },
      response: { status: 200 },
    } as never)
    renderWithQuery(<AdminSearch />)

    await userEvent.type(screen.getByRole("combobox", { name: "Search users and events" }), "mega")

    expect(await screen.findByRole("link", { name: /Lea Tan/ })).toHaveAttribute("href", `/admin/users/${id(1)}`)
    expect(screen.getByRole("link", { name: /Black Friday Mega Ukay/ })).toHaveAttribute("href", `/admin/events/${id(2)}`)
  })

  it("says when nothing matches", async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: { people: [], events: [] }, response: { status: 200 } } as never)
    renderWithQuery(<AdminSearch />)

    await userEvent.type(screen.getByRole("combobox", { name: "Search users and events" }), "zzz")

    expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument()
  })
})
