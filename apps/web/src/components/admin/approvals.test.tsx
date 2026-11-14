import type { ApprovalDetail } from "@creavent/shared"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { ApprovalQueue } from "./approval-queue"
import { ApprovalReview } from "./approval-review"

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const push = vi.fn()
const userId = "8d4a7f3e-1b2c-4d5e-8f90-123456789abc"
const nextId = "9d4a7f3e-1b2c-4d5e-8f90-123456789abc"

const detail: ApprovalDetail = {
  userId,
  displayName: "Bazaar ng Mintal",
  slug: "bazaar-ng-mintal",
  city: "Davao City",
  about: "Monthly bazaar.",
  logoUrl: null,
  socialLinks: ["https://facebook.com/bazaarngmintal"],
  fullName: "Rosalie Cabahug",
  loginEmail: "rosalie@example.com",
  contactEmail: "bazaar@example.com",
  phone: "+639176502281",
  accountCreatedAt: "2026-11-02T02:00:00.000Z",
  roles: ["organizer", "vendor"],
  status: "pending_review",
  submittedAt: "2026-11-09T02:00:00.000Z",
  reviewedAt: null,
  rejectionReason: null,
  adminNotes: null,
  queue: { position: 1, total: 7, nextUserId: nextId },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ push, replace: vi.fn() } as never)
})

describe("ApprovalQueue", () => {
  it("lists waiting organizers with their links and a link to review each", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { items: [{ userId, displayName: "Bazaar ng Mintal", city: "Davao City", linksCount: 3, submittedAt: "2026-11-09T02:00:00.000Z", resubmission: true }] },
      response: { status: 200 },
    } as never)
    renderWithQuery(<ApprovalQueue />)

    const link = await screen.findByRole("link", { name: /Bazaar ng Mintal/ })
    expect(link).toHaveAttribute("href", `/admin/approvals/${userId}`)
    expect(screen.getByText(/3 links/)).toBeInTheDocument()
    expect(screen.getByText("Resubmitted")).toBeInTheDocument()
  })

  it("says when nobody is waiting", async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: { items: [] }, response: { status: 200 } } as never)
    renderWithQuery(<ApprovalQueue />)

    expect(await screen.findByText("No organizers are waiting for review.")).toBeInTheDocument()
  })
})

describe("ApprovalReview", () => {
  function serve(d = detail) {
    vi.mocked(api.GET).mockResolvedValue({ data: d, response: { status: 200 } } as never)
  }

  it("shows the links to check, the contact details, and the place in the queue", async () => {
    serve()
    renderWithQuery(<ApprovalReview userId={userId} />)

    expect(await screen.findByRole("heading", { name: "Bazaar ng Mintal" })).toBeInTheDocument()
    expect(screen.getByText("1 of 7 in queue")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /facebook\.com.*\/bazaarngmintal/ })).toHaveAttribute("href", "https://facebook.com/bazaarngmintal")
    expect(screen.getByText("bazaar@example.com")).toBeInTheDocument()
    expect(screen.getByText(/also a vendor/)).toBeInTheDocument()
  })

  it("shows each link's real host, marking sites that aren't well-known social sites", async () => {
    serve({ ...detail, socialLinks: ["https://www.facebook.com/bazaar", "https://facebook.com-events.evil.example/page", "javascript:alert(1)"] })
    renderWithQuery(<ApprovalReview userId={userId} />)

    const links = await screen.findByRole("list", { name: "Links to check" })
    const items = within(links).getAllByRole("listitem")
    expect(within(items[0]).getByText("www.facebook.com")).toBeInTheDocument()
    expect(within(items[0]).getByText("Known site")).toBeInTheDocument()
    expect(within(items[1]).getByText("facebook.com-events.evil.example")).toBeInTheDocument()
    expect(within(items[1]).getByText("External site")).toBeInTheDocument()
    expect(within(items[2]).queryByRole("link")).not.toBeInTheDocument()
    expect(within(items[2]).getByText("Not a valid link")).toBeInTheDocument()
  })

  it("approves with the internal note and moves to the next request", async () => {
    serve()
    vi.mocked(api.POST).mockResolvedValue({ data: { ...detail, status: "approved" }, response: { status: 200 } } as never)
    renderWithQuery(<ApprovalReview userId={userId} />)

    await userEvent.type(await screen.findByLabelText(/Internal note/), "Checked 3 past events")
    await userEvent.click(screen.getByRole("button", { name: "Approve Bazaar ng Mintal" }))

    expect(api.POST).toHaveBeenCalledWith("/api/admin/approvals/{userId}/approve", {
      params: { path: { userId } },
      body: { note: "Checked 3 past events", seen: { displayName: "Bazaar ng Mintal", socialLinks: detail.socialLinks } },
    })
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/approvals/${nextId}`))
  })

  it("rejects with a reason, which a quick pick can fill", async () => {
    serve()
    vi.mocked(api.POST).mockResolvedValue({ data: { ...detail, status: "rejected" }, response: { status: 200 } } as never)
    renderWithQuery(<ApprovalReview userId={userId} />)

    await userEvent.click(await screen.findByRole("radio", { name: /Reject with a reason/ }))
    await userEvent.click(screen.getByRole("button", { name: "Add past events" }))
    await userEvent.click(screen.getByRole("button", { name: "Reject and email Rosalie" }))

    expect(api.POST).toHaveBeenCalledWith("/api/admin/approvals/{userId}/reject", {
      params: { path: { userId } },
      body: { reason: expect.stringContaining("past events"), note: "", seen: { displayName: "Bazaar ng Mintal", socialLinks: detail.socialLinks } },
    })
  })

  it("needs a reason to reject", async () => {
    serve()
    renderWithQuery(<ApprovalReview userId={userId} />)

    await userEvent.click(await screen.findByRole("radio", { name: /Reject with a reason/ }))
    await userEvent.click(screen.getByRole("button", { name: "Reject and email Rosalie" }))

    expect(await screen.findByText("Tell the organizer what to fix")).toBeInTheDocument()
    expect(api.POST).not.toHaveBeenCalled()
  })

  it("shows the decision already made instead of the form", async () => {
    serve({ ...detail, status: "approved", reviewedAt: "2026-11-10T02:00:00.000Z" })
    renderWithQuery(<ApprovalReview userId={userId} />)

    expect(await screen.findByText(/Approved on/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Approve Bazaar/ })).not.toBeInTheDocument()
  })
})
