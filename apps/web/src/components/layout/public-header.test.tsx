import { renderWithQuery as render } from "@/test-utils"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { usePathname } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PublicHeader } from "./public-header"

vi.mock("next/navigation", () => ({ usePathname: vi.fn(), useRouter: () => ({ replace: vi.fn() }) }))

beforeEach(() => vi.mocked(usePathname).mockReturnValue("/"))

describe("PublicHeader", () => {
  it("shows the logo, Events, Log in, and Sign up when signed out", () => {
    render(<PublicHeader />)

    expect(screen.getByRole("link", { name: "creavent" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login")
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup")
  })

  it("marks Events as the current page on the listing", () => {
    render(<PublicHeader />)

    expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute("aria-current", "page")
  })

  it("does not mark Events on other pages", () => {
    vi.mocked(usePathname).mockReturnValue("/terms")
    render(<PublicHeader />)

    expect(screen.getByRole("link", { name: "Events" })).not.toHaveAttribute("aria-current")
  })

  it("shows the account menu instead of Log in and Sign up when signed in", async () => {
    render(<PublicHeader user={{ name: "Lola's Ukay", initials: "LU", roles: [] }} />)

    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Account menu, Lola's Ukay" }))
    expect(screen.getByRole("menuitem", { name: "Become a vendor" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Become an organizer" })).toBeInTheDocument()
  })
})
