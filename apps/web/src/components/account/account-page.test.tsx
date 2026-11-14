import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { renderWithQuery, signedInMe } from "@/test-utils"
import { AccountPage } from "./account-page"

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), PATCH: vi.fn(), PUT: vi.fn(), POST: vi.fn() } }))
vi.mock("@/lib/auth-client", () => ({ authClient: { changeEmail: vi.fn(), changePassword: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const vendorRole = { role: "vendor" as const, approvalStatus: null, rejectionReason: null, onboardingStep: 4, suspended: false, suspensionReason: null }
const me = { ...signedInMe, phone: "+639174821093", roles: [vendorRole] }
const details = {
  passwordChangedAt: "2026-03-02T02:00:00.000Z",
  googleLinked: false,
  legal: [
    { document: "terms", version: "2026-11-12", acceptedAt: "2026-03-02T02:00:00.000Z" },
    { document: "privacy", version: "2026-11-12", acceptedAt: "2026-03-02T02:00:00.000Z" },
  ],
  vendor: { shopName: "Lola's Ukay", since: "2026-03-02T02:00:00.000Z" },
  organizer: null,
}
const config = { termsVersion: "2026-11-12", privacyVersion: "2026-11-12", minimumAge: 18, supportEmail: "support@creavent.example", googleSignIn: true }

function serve(overrides: { me?: object; details?: object } = {}) {
  vi.mocked(api.GET).mockImplementation((async (path: string) => ({
    data: path === "/api/me" ? { ...me, ...overrides.me } : path === "/api/account" ? { ...details, ...overrides.details } : config,
    response: { status: 200 },
  })) as never)
}

const section = (name: string) => screen.getByRole("region", { name })

beforeEach(() => {
  vi.clearAllMocks()
  serve()
})

describe("AccountPage", () => {
  it("has the four sections, with links to each", async () => {
    renderWithQuery(<AccountPage />)

    const nav = await screen.findByRole("navigation", { name: "Account sections" })
    expect(within(nav).getAllByRole("link").map((l) => l.textContent)).toEqual([
      "Personal details",
      "Email and sign-in",
      "Roles",
      "Terms and privacy",
    ])
    expect(section("Personal details")).toBeInTheDocument()
  })

  it("saves the name and mobile number together", async () => {
    vi.mocked(api.PATCH).mockResolvedValue({ data: me, response: { status: 200 } } as never)
    renderWithQuery(<AccountPage />)

    const name = await screen.findByLabelText("Full name")
    await userEvent.clear(name)
    await userEvent.type(name, "Maria Clara")
    await userEvent.click(within(section("Personal details")).getByRole("button", { name: "Save details" }))

    expect(api.PATCH).toHaveBeenCalledWith("/api/me", { body: { fullName: "Maria Clara", phone: "9174821093" } })
  })

  it("shows the email as confirmed and changes it from a form that opens on demand", async () => {
    vi.mocked(authClient.changeEmail).mockResolvedValue({ data: {}, error: null } as never)
    renderWithQuery(<AccountPage />)

    const signIn = await screen.findByRole("region", { name: "Email and sign-in" })
    expect(within(signIn).getByText("Confirmed")).toBeInTheDocument()
    await userEvent.click(within(signIn).getByRole("button", { name: "Change email" }))
    await userEvent.type(screen.getByLabelText("New email"), "new@example.com")
    await userEvent.click(screen.getByRole("button", { name: "Send confirmation link" }))

    expect(authClient.changeEmail).toHaveBeenCalledWith({ newEmail: "new@example.com", callbackURL: "/account" })
    expect(await screen.findByText("We sent a link to maria@example.com to approve the change.")).toBeInTheDocument()
  })

  it("shows when the password last changed, and changes it", async () => {
    vi.mocked(authClient.changePassword).mockResolvedValue({ data: {}, error: null } as never)
    renderWithQuery(<AccountPage />)

    expect(await screen.findByText(/Last changed Mar 2, 2026/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Change password" }))
    await userEvent.type(screen.getByLabelText("Current password"), "old-password")
    await userEvent.type(screen.getByLabelText("New password"), "a-new-password")
    await userEvent.click(screen.getByRole("button", { name: "Save new password" }))

    expect(authClient.changePassword).toHaveBeenCalledWith({ currentPassword: "old-password", newPassword: "a-new-password", revokeOtherSessions: true })
  })

  it("says whether Google is connected", async () => {
    renderWithQuery(<AccountPage />)

    expect(await screen.findByText(/Not connected/)).toBeInTheDocument()
  })

  it("tells a Google-only user they have no password", async () => {
    serve({ me: { hasPassword: false }, details: { passwordChangedAt: null, googleLinked: true } })
    renderWithQuery(<AccountPage />)

    expect(await screen.findByText(/You sign in with Google/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Change password" })).not.toBeInTheDocument()
  })

  it("shows a card for each role: the vendor one active, the organizer one to add", async () => {
    renderWithQuery(<AccountPage />)

    const roles = await screen.findByRole("region", { name: "Roles" })
    expect(await within(roles).findByText(/Lola's Ukay · since Mar 2026/)).toBeInTheDocument()
    expect(within(roles).getByText("Active")).toBeInTheDocument()
    expect(within(roles).getByRole("link", { name: "Edit shop profile" })).toHaveAttribute("href", "/vendor/profile")
    expect(within(roles).getByText("Not added")).toBeInTheDocument()
    expect(within(roles).getByRole("link", { name: "Add organizer role" })).toHaveAttribute("href", "/onboarding?role=organizer")
  })

  it("shows a suspended role with the reason", async () => {
    serve({ me: { roles: [{ ...vendorRole, suspended: true, suspensionReason: "Reported by 3 organizers" }] } })
    renderWithQuery(<AccountPage />)

    expect(await screen.findByText(/Reported by 3 organizers/)).toBeInTheDocument()
  })

  it("lists the accepted terms and privacy versions, and how to close the account", async () => {
    renderWithQuery(<AccountPage />)

    const legal = await screen.findByRole("region", { name: "Terms and privacy" })
    await vi.waitFor(() => expect(within(legal).getAllByText(/Accepted version 2026-11-12 on Mar 2, 2026/)).toHaveLength(2))
    expect(await within(legal).findByRole("link", { name: "support@creavent.example" })).toHaveAttribute("href", "mailto:support@creavent.example")
  })
})
