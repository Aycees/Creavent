import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { ForgotPasswordForm } from "./forgot-password-form"
import { LegalForm } from "./legal-form"
import { LoginForm } from "./login-form"
import { ResetPasswordForm } from "./reset-password-form"
import { renderWithQuery, signedInMe } from "@/test-utils"
import { VerifyEmailResult } from "./verify-email-result"

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }))
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: vi.fn(), social: vi.fn() },
    sendVerificationEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
  },
}))

const replace = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ replace } as never)
})

function meResponse(me: object) {
  vi.mocked(api.GET).mockResolvedValue({ data: me, response: { status: 200 } } as never)
}

async function logIn(email = "maria@example.com", password = "ukaylover22") {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText("Email"), email)
  await user.type(screen.getByLabelText("Password"), password)
  await user.click(screen.getByRole("button", { name: "Log in" }))
}

describe("LoginForm", () => {
  it("signs in and sends a user with no role to onboarding", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({ data: {}, error: null } as never)
    meResponse(signedInMe)
    renderWithQuery(<LoginForm googleSignIn={false} />)

    await logIn()

    expect(authClient.signIn.email).toHaveBeenCalledWith({ email: "maria@example.com", password: "ukaylover22" })
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding"))
  })

  it("sends a vendor who finished onboarding to the vendor dashboard", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({ data: {}, error: null } as never)
    meResponse({
      ...signedInMe,
      roles: [{ role: "vendor", approvalStatus: null, rejectionReason: null, onboardingStep: 4, suspended: false, suspensionReason: null }],
    })
    renderWithQuery(<LoginForm googleSignIn={false} />)

    await logIn()

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/vendor"))
  })

  it("goes back to the page that asked for sign-in", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({ data: {}, error: null } as never)
    meResponse(signedInMe)
    renderWithQuery(<LoginForm googleSignIn={false} next="/account" />)

    await logIn()

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/account"))
  })

  it("says when the email or password is wrong", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({ data: null, error: { status: 401 } } as never)
    renderWithQuery(<LoginForm googleSignIn={false} />)

    await logIn()

    expect(await screen.findByText("Wrong email or password.")).toBeInTheDocument()
  })

  it("offers a new link when the email is not confirmed yet", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({ data: null, error: { status: 403, code: "EMAIL_NOT_VERIFIED" } } as never)
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({ data: {}, error: null } as never)
    renderWithQuery(<LoginForm googleSignIn={false} />)

    await logIn()
    await userEvent.click(await screen.findByRole("button", { name: "Send a new link" }))

    expect(screen.getByText(/Confirm your email first/)).toBeInTheDocument()
    expect(authClient.sendVerificationEmail).toHaveBeenCalledWith({ email: "maria@example.com", callbackURL: "/verify-email" })
  })

  it("explains the lockout after too many tries", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({ data: null, error: { status: 429 } } as never)
    renderWithQuery(<LoginForm googleSignIn={false} />)

    await logIn()

    expect(await screen.findByText(/Too many tries/)).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: /Forgot password|reset your password/ }).length).toBeGreaterThan(0)
  })

  it("links to account creation for each role", () => {
    renderWithQuery(<LoginForm googleSignIn={false} />)

    expect(screen.getByRole("link", { name: "Vendor account" })).toHaveAttribute("href", "/signup?as=vendor")
    expect(screen.getByRole("link", { name: "Organizer account" })).toHaveAttribute("href", "/signup?as=organizer")
  })
})

describe("ForgotPasswordForm", () => {
  it("asks for a reset link and says it was sent, without saying whether the account exists", async () => {
    vi.mocked(authClient.requestPasswordReset).mockResolvedValue({ data: {}, error: null } as never)
    renderWithQuery(<ForgotPasswordForm />)

    await userEvent.type(screen.getByLabelText("Email"), "maria@example.com")
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }))

    expect(authClient.requestPasswordReset).toHaveBeenCalledWith({ email: "maria@example.com", redirectTo: "/reset-password" })
    expect(await screen.findByText(/If maria@example.com has an account/)).toBeInTheDocument()
  })
})

describe("ResetPasswordForm", () => {
  it("sets the new password and offers to log in", async () => {
    vi.mocked(authClient.resetPassword).mockResolvedValue({ data: {}, error: null } as never)
    renderWithQuery(<ResetPasswordForm token="abc" error={null} />)

    await userEvent.type(screen.getByLabelText("New password"), "a-new-password")
    await userEvent.click(screen.getByRole("button", { name: "Set new password" }))

    expect(authClient.resetPassword).toHaveBeenCalledWith({ newPassword: "a-new-password", token: "abc" })
    expect(await screen.findByText("Your password is changed.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login")
  })

  it("says the link expired and offers a new one", () => {
    renderWithQuery(<ResetPasswordForm token={null} error="INVALID_TOKEN" />)

    expect(screen.getByRole("heading", { name: "This link has expired" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Get a new link" })).toHaveAttribute("href", "/forgot-password")
  })

  it("refuses a short password", async () => {
    renderWithQuery(<ResetPasswordForm token="abc" error={null} />)

    await userEvent.type(screen.getByLabelText("New password"), "short")
    await userEvent.click(screen.getByRole("button", { name: "Set new password" }))

    expect(await screen.findByText("Use at least 8 characters")).toBeInTheDocument()
    expect(authClient.resetPassword).not.toHaveBeenCalled()
  })
})

describe("VerifyEmailResult", () => {
  it("sends a confirmed user on to onboarding with their signup choice", async () => {
    renderWithQuery(<VerifyEmailResult error={null} role="organizer" />)

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding?role=organizer&confirmed=1"))
  })

  it("says the link expired and sends a new one", async () => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({ data: {}, error: null } as never)
    renderWithQuery(<VerifyEmailResult error="TOKEN_EXPIRED" role="vendor" />)

    expect(screen.getByRole("heading", { name: "This link has expired" })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("Email"), "maria@example.com")
    await userEvent.click(screen.getByRole("button", { name: "Send a new link" }))

    expect(authClient.sendVerificationEmail).toHaveBeenCalledWith({
      email: "maria@example.com",
      callbackURL: "/verify-email?role=vendor",
    })
    expect(await screen.findByText(/We sent a new link/)).toBeInTheDocument()
  })
})

describe("LegalForm", () => {
  it("records the acceptance and moves on", async () => {
    vi.mocked(api.POST).mockResolvedValue({ data: { ...signedInMe, needsLegal: false }, response: { status: 200 } } as never)
    renderWithQuery(<LegalForm />)

    await userEvent.click(screen.getByRole("checkbox", { name: "I'm 18 or older" }))
    await userEvent.click(screen.getByRole("checkbox", { name: /I agree to the Terms of use and Privacy notice/ }))
    await userEvent.click(screen.getByRole("button", { name: "Accept and continue" }))

    expect(api.POST).toHaveBeenCalledWith("/api/me/legal", { body: { ageConfirmed: true, acceptLegal: true } })
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding"))
  })

  it("needs both boxes ticked", async () => {
    renderWithQuery(<LegalForm />)

    await userEvent.click(screen.getByRole("button", { name: "Accept and continue" }))

    expect(await screen.findByText("Confirm you are 18 or older")).toBeInTheDocument()
    expect(api.POST).not.toHaveBeenCalled()
  })
})
