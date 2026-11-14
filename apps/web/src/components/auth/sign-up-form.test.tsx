import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { authClient } from "@/lib/auth-client"
import { SignUpForm } from "./sign-up-form"

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: { email: vi.fn() },
    signIn: { social: vi.fn() },
    sendVerificationEmail: vi.fn(),
  },
}))

const signUp = vi.mocked(authClient.signUp.email)

async function fillValidForm() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText("Full name"), "Maria Santos")
  await user.type(screen.getByLabelText("Email"), "maria@example.com")
  await user.type(screen.getByLabelText("Password"), "ukaylover22")
  await user.click(screen.getByRole("checkbox", { name: "I'm 18 or older" }))
  await user.click(screen.getByRole("checkbox", { name: /I agree to the Terms of use and Privacy notice/ }))
  return user
}

beforeEach(() => {
  signUp.mockReset()
})

describe("SignUpForm", () => {
  it("asks what the user signs up to do, pre-selected from the link", () => {
    render(<SignUpForm initialRole="organizer" googleSignIn={false} />)

    expect(screen.getByRole("radio", { name: /Run events/ })).toBeChecked()
    expect(screen.getByRole("button", { name: "Create organizer account" })).toBeInTheDocument()
  })

  it("names the account after the chosen role", async () => {
    render(<SignUpForm initialRole="organizer" googleSignIn={false} />)

    await userEvent.click(screen.getByRole("radio", { name: /Sell at events/ }))

    expect(screen.getByRole("button", { name: "Create vendor account" })).toBeInTheDocument()
  })

  it("shows what is missing when the form is sent empty", async () => {
    render(<SignUpForm initialRole="vendor" googleSignIn={false} />)

    await userEvent.click(screen.getByRole("button", { name: "Create vendor account" }))

    expect(await screen.findByText("Enter your full name")).toBeInTheDocument()
    expect(screen.getByText("Enter a valid email")).toBeInTheDocument()
    expect(screen.getByText("Use at least 8 characters")).toBeInTheDocument()
    expect(screen.getByText("Confirm you are 18 or older")).toBeInTheDocument()
    expect(screen.getByText("Accept the terms of use and privacy notice")).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })

  it("creates the account and asks the user to check their inbox", async () => {
    signUp.mockResolvedValue({ data: {}, error: null } as never)
    render(<SignUpForm initialRole="vendor" googleSignIn={false} />)
    const user = await fillValidForm()

    await user.click(screen.getByRole("button", { name: "Create vendor account" }))

    expect(signUp).toHaveBeenCalledWith({
      name: "Maria Santos",
      email: "maria@example.com",
      password: "ukaylover22",
      ageConfirmed: true,
      acceptLegal: true,
      callbackURL: "/verify-email?role=vendor",
    })
    expect(await screen.findByRole("heading", { name: "Check your inbox" })).toBeInTheDocument()
    expect(screen.getByText(/maria@example.com/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send the link again" })).toBeInTheDocument()
  })

  it("says when the email already has an account", async () => {
    signUp.mockResolvedValue({ data: null, error: { status: 422, code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" } } as never)
    render(<SignUpForm initialRole="vendor" googleSignIn={false} />)
    const user = await fillValidForm()

    await user.click(screen.getByRole("button", { name: "Create vendor account" }))

    expect(await screen.findByText(/already has an account/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login")
  })

  it("shows Continue with Google only when Google sign-in is on", () => {
    const { rerender } = render(<SignUpForm initialRole="vendor" googleSignIn={false} />)
    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument()

    rerender(<SignUpForm initialRole="vendor" googleSignIn />)
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument()
  })

  it("shows and hides the password", async () => {
    render(<SignUpForm initialRole="vendor" googleSignIn={false} />)

    await userEvent.click(screen.getByRole("button", { name: "Show password" }))

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text")
  })
})
