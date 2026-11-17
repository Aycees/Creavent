import type { HostApproval } from "@creavent/shared"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { HostApprovalPage } from "./host-approval"
import { hostApproval } from "./fixtures"

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }))

function serve(host: HostApproval) {
  vi.mocked(api.GET).mockImplementation(((path: string) =>
    Promise.resolve(
      path === "/api/public-config"
        ? { data: { supportEmail: "support@creavent.ph", googleSignIn: false }, response: { status: 200 } }
        : { data: host, response: { status: 200 } }
    )) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("HostApprovalPage (/vendor/host-approval)", () => {
  it("asks for at least one link, saved on the vendor page, and says what we check", async () => {
    serve(hostApproval())
    renderWithQuery(<HostApprovalPage />)

    expect(await screen.findByRole("heading", { name: "Get approved to host pop-ups" })).toBeInTheDocument()
    expect(screen.getByText("Not submitted")).toBeInTheDocument()
    expect(screen.getByText(/also show on your vendor page/)).toBeInTheDocument()
    expect(screen.getByText("Real products or past stalls in photos or posts")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }))

    expect(await screen.findByText("Add at least one link")).toBeInTheDocument()
    expect(api.POST).not.toHaveBeenCalled()
  })

  it("submits the links for review", async () => {
    serve(hostApproval())
    vi.mocked(api.POST).mockResolvedValue({ data: hostApproval({ status: "pending_review" }), response: { status: 200 } } as never)
    renderWithQuery(<HostApprovalPage />)

    await userEvent.type(await screen.findByLabelText("Link to your shop's page"), "instagram.com/tahistudio.dvo{Enter}")
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }))

    expect(api.POST).toHaveBeenCalledWith("/api/vendor/host-approval", { body: { socialLinks: ["instagram.com/tahistudio.dvo"] } })
  })

  it("shows the links being checked while pending", async () => {
    serve(hostApproval({ status: "pending_review", submittedAt: "2026-11-12T02:00:00.000Z", socialLinks: ["https://instagram.com/tahistudio.dvo"] }))
    renderWithQuery(<HostApprovalPage />)

    expect(await screen.findByRole("heading", { name: "We're checking your shop" })).toBeInTheDocument()
    expect(screen.getByText(/Submitted Thu, Nov 12/)).toBeInTheDocument()
    expect(within(screen.getByRole("list", { name: "Links we're checking" })).getByText("instagram.com/tahistudio.dvo")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Submit/ })).not.toBeInTheDocument()
  })

  it("says how an approval was granted", async () => {
    serve(hostApproval({ status: "approved", source: "earned", decidedAt: "2026-10-17T02:00:00.000Z", justEarned: false }))
    renderWithQuery(<HostApprovalPage />)

    expect(await screen.findByRole("heading", { name: "You can host pop-ups" })).toBeInTheDocument()
    expect(screen.getByText("Approved by Creavent")).toBeInTheDocument()
    expect(screen.getByText(/Approved Sat, Oct 17, because you sold at a Creavent event/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go to my pop-ups" })).toHaveAttribute("href", "/vendor/popups")
  })

  it("shows the reason after a rejection and lets the vendor resubmit", async () => {
    serve(hostApproval({ status: "rejected", decidedAt: "2026-11-13T02:00:00.000Z", rejectionReason: "Your Instagram has no posts yet.", socialLinks: ["https://instagram.com/tahistudio.dvo"] }))
    vi.mocked(api.POST).mockResolvedValue({ data: hostApproval({ status: "pending_review" }), response: { status: 200 } } as never)
    renderWithQuery(<HostApprovalPage />)

    expect(await screen.findByRole("heading", { name: "Add a bit more, then resubmit" })).toBeInTheDocument()
    expect(screen.getByText(/Your Instagram has no posts yet/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Resubmit for review" }))

    expect(api.POST).toHaveBeenCalledWith("/api/vendor/host-approval", { body: { socialLinks: ["https://instagram.com/tahistudio.dvo"] } })
  })

  it("explains a revoke: pop-ups hidden, selling elsewhere still works, and how to host again", async () => {
    serve(hostApproval({ status: "rejected", revoked: true, decidedAt: "2026-11-18T02:00:00.000Z", rejectionReason: "Two visitors reported the Nov 21 pop-up didn't take place." }))
    renderWithQuery(<HostApprovalPage />)

    expect(await screen.findByRole("heading", { name: "Your host approval was revoked" })).toBeInTheDocument()
    expect(screen.getByText("Revoked")).toBeInTheDocument()
    expect(screen.getByText(/Your announced pop-ups are hidden/)).toBeInTheDocument()
    expect(await screen.findByRole("link", { name: "support@creavent.ph" })).toHaveAttribute("href", "mailto:support@creavent.ph")
    expect(screen.getByRole("button", { name: "Resubmit for review" })).toBeInTheDocument()
  })
})
