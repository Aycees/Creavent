import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { renderWithQuery, signedInMe } from "@/test-utils"
import { AccountPage } from "./account-page"

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), PATCH: vi.fn(), PUT: vi.fn() } }))
vi.mock("@/lib/auth-client", () => ({ authClient: { changeEmail: vi.fn(), changePassword: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const me = {
  ...signedInMe,
  phone: "+639174821093",
  roles: [
    { role: "vendor" as const, approvalStatus: null, rejectionReason: null, onboardingStep: 4, suspended: false, suspensionReason: null },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.GET).mockResolvedValue({ data: me, response: { status: 200 } } as never)
})

function section(name: string) {
  return screen.getByRole("region", { name })
}

describe("AccountPage", () => {
  it("shows the profile, email, number, and roles", async () => {
    renderWithQuery(<AccountPage />)

    expect(await screen.findByDisplayValue("Maria Santos")).toBeInTheDocument()
    expect(within(section("Email")).getByText("maria@example.com")).toBeInTheDocument()
    expect(screen.getByDisplayValue("9174821093")).toBeInTheDocument()
    expect(within(section("Roles")).getByText("Vendor")).toBeInTheDocument()
    expect(within(section("Roles")).getByRole("link", { name: "Become an organizer" })).toHaveAttribute("href", "/onboarding?role=organizer")
  })

  it("saves a new name", async () => {
    vi.mocked(api.PATCH).mockResolvedValue({ data: { ...me, fullName: "Maria Clara" }, response: { status: 200 } } as never)
    renderWithQuery(<AccountPage />)

    const name = await screen.findByLabelText("Full name")
    await userEvent.clear(name)
    await userEvent.type(name, "Maria Clara")
    await userEvent.click(within(section("Profile")).getByRole("button", { name: "Save" }))

    expect(api.PATCH).toHaveBeenCalledWith("/api/me", { body: { fullName: "Maria Clara" } })
  })

  it("asks the current address to approve a new email address", async () => {
    vi.mocked(authClient.changeEmail).mockResolvedValue({ data: {}, error: null } as never)
    renderWithQuery(<AccountPage />)

    await userEvent.type(await screen.findByLabelText("New email"), "new@example.com")
    await userEvent.click(within(section("Email")).getByRole("button", { name: "Send confirmation link" }))

    expect(authClient.changeEmail).toHaveBeenCalledWith({ newEmail: "new@example.com", callbackURL: "/account" })
    expect(await screen.findByText("We sent a link to maria@example.com to approve the change.")).toBeInTheDocument()
    expect(screen.getByText(/send one to new@example.com/)).toBeInTheDocument()
  })

  it("changes the password with the current one", async () => {
    vi.mocked(authClient.changePassword).mockResolvedValue({ data: {}, error: null } as never)
    renderWithQuery(<AccountPage />)

    await userEvent.type(await screen.findByLabelText("Current password"), "old-password")
    await userEvent.type(screen.getByLabelText("New password"), "a-new-password")
    await userEvent.click(within(section("Password")).getByRole("button", { name: "Change password" }))

    expect(authClient.changePassword).toHaveBeenCalledWith({
      currentPassword: "old-password",
      newPassword: "a-new-password",
      revokeOtherSessions: true,
    })
  })

  it("tells a Google-only user they sign in with Google", async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: { ...me, hasPassword: false }, response: { status: 200 } } as never)
    renderWithQuery(<AccountPage />)

    expect(await screen.findByText(/You sign in with Google/)).toBeInTheDocument()
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument()
  })

  it("shows a suspended role with the reason", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { ...me, roles: [{ ...me.roles[0], suspended: true, suspensionReason: "Reported by 3 organizers" }] },
      response: { status: 200 },
    } as never)
    renderWithQuery(<AccountPage />)

    expect(await screen.findByText(/Reported by 3 organizers/)).toBeInTheDocument()
  })
})
