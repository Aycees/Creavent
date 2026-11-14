import { screen } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithQuery, signedInMe } from "@/test-utils"
import { api } from "@/lib/api"
import { SessionGate } from "./session-gate"

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }))

const replace = vi.fn()
const vendorRole = { role: "vendor", approvalStatus: null, rejectionReason: null, onboardingStep: 4, suspended: false, suspensionReason: null }

function signedInAs(me: object | null) {
  vi.mocked(api.GET).mockResolvedValue(
    (me ? { data: me, response: { status: 200 } } : { data: undefined, response: { status: 401 } }) as never
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ replace } as never)
  window.history.pushState({}, "", "/vendor/events")
})

describe("SessionGate", () => {
  it("always renders the page, hidden until the session is checked, so Next.js can prerender it", () => {
    vi.mocked(api.GET).mockReturnValue(new Promise(() => {}) as never)
    renderWithQuery(<SessionGate>{() => "page"}</SessionGate>)

    expect(screen.getByText("page")).not.toBeVisible()
    expect(screen.getByRole("status")).toHaveTextContent("Loading")
  })

  it("sends a signed-out visitor to log in, coming back afterwards", async () => {
    signedInAs(null)
    renderWithQuery(<SessionGate>{() => "secret"}</SessionGate>)

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Fvendor%2Fevents"))
    expect(screen.getByText("secret")).not.toBeVisible()
  })

  it("sends a user who must accept new terms to /account/legal first", async () => {
    signedInAs({ ...signedInMe, needsLegal: true })
    renderWithQuery(<SessionGate>{() => "page"}</SessionGate>)

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/account/legal"))
  })

  it("lets /account/legal itself show to that user", async () => {
    window.history.pushState({}, "", "/account/legal")
    signedInAs({ ...signedInMe, needsLegal: true })
    renderWithQuery(<SessionGate>{() => "legal page"}</SessionGate>)

    await vi.waitFor(() => expect(screen.getByText("legal page")).toBeVisible())
    expect(replace).not.toHaveBeenCalled()
  })

  it("keeps a user without the vendor role out of the vendor area", async () => {
    signedInAs(signedInMe)
    renderWithQuery(<SessionGate area="vendor">{() => "vendor page"}</SessionGate>)

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding?role=vendor"))
    expect(screen.getByText("vendor page")).not.toBeVisible()
  })

  it("keeps non-admins out of the admin area", async () => {
    signedInAs({ ...signedInMe, roles: [vendorRole] })
    renderWithQuery(<SessionGate area="admin">{() => "admin page"}</SessionGate>)

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/vendor"))
  })

  it("shows the page to a vendor in the vendor area, with the user", async () => {
    signedInAs({ ...signedInMe, roles: [vendorRole] })
    renderWithQuery(<SessionGate area="vendor">{(me) => `Hello ${me?.fullName ?? ""}`}</SessionGate>)

    await vi.waitFor(() => expect(screen.getByText("Hello Maria Santos")).toBeVisible())
  })
})
