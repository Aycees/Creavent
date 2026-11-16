import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery, signedInMe } from "@/test-utils"
import { ReportLink } from "./report-link"

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const SUPPORT = "support@creavent.example"
const eventId = "5e0c7b2a-3f4d-4c8e-9a1b-2c3d4e5f6a7b"
const ownerId = "6e0c7b2a-3f4d-4c8e-9a1b-2c3d4e5f6a7b"

function serve({ me = signedInMe as unknown, mine = null as number | null } = {}) {
  vi.mocked(api.GET).mockImplementation(((path: string) => {
    if (path === "/api/me") return Promise.resolve(me ? { data: me, response: { status: 200 } } : { data: undefined, response: { status: 401 } })
    return Promise.resolve({ data: { number: mine }, response: { status: 200 } })
  }) as never)
}

function renderLink() {
  return renderWithQuery(<ReportLink targetType="event" targetId={eventId} ownerUserId={ownerId} noun="event" supportEmail={SUPPORT} />)
}

beforeEach(() => vi.clearAllMocks())

// The report button (spec §2.2): signed-in users report, anyone else emails support.
describe("ReportLink", () => {
  it("points signed-out visitors to the support email", async () => {
    serve({ me: null })
    renderLink()

    expect(await screen.findByRole("link", { name: SUPPORT })).toHaveAttribute("href", `mailto:${SUPPORT}`)
    expect(screen.queryByRole("button", { name: "Report this event" })).not.toBeInTheDocument()
  })

  it("doesn't offer to report your own event", async () => {
    serve({ me: { ...signedInMe, id: ownerId } })
    renderLink()

    expect(await screen.findByRole("link", { name: SUPPORT })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Report this event" })).not.toBeInTheDocument()
  })

  it("sends a report with a reason and what happened, then shows the reference", async () => {
    serve()
    vi.mocked(api.POST).mockResolvedValue({ data: { number: 143 }, response: { status: 201 } } as never)
    renderLink()

    await userEvent.click(await screen.findByRole("button", { name: "Report this event" }))
    await userEvent.click(screen.getByRole("radio", { name: /Scam/ }))
    await userEvent.type(screen.getByLabelText(/What happened/), "Asked for a GCash deposit")
    await userEvent.click(screen.getByRole("button", { name: "Send report" }))

    expect(api.POST).toHaveBeenCalledWith("/api/reports", {
      body: { targetType: "event", targetId: eventId, reason: "scam", details: "Asked for a GCash deposit" },
    })
    expect(await screen.findByText(/You reported this event/)).toHaveTextContent("RPT-0143")
  })

  it("asks for a reason before sending", async () => {
    serve()
    renderLink()

    await userEvent.click(await screen.findByRole("button", { name: "Report this event" }))
    await userEvent.click(screen.getByRole("button", { name: "Send report" }))

    expect(await screen.findByText("Choose what's wrong")).toBeInTheDocument()
    expect(api.POST).not.toHaveBeenCalled()
  })

  it("shows an open report instead of the button", async () => {
    serve({ mine: 42 })
    renderLink()

    expect(await screen.findByText(/You reported this event/)).toHaveTextContent("RPT-0042")
    expect(screen.queryByRole("button", { name: "Report this event" })).not.toBeInTheDocument()
  })
})
