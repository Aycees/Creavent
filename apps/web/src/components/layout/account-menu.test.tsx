import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { ShellUser } from "@/lib/shell-user"
import { renderWithQuery } from "@/test-utils"
import { AccountMenu } from "./account-menu"

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }))

const user = (roles: ShellUser["roles"], isAdmin = false): ShellUser => ({ name: "Maria Santos", initials: "MS", roles, isAdmin, avatarUrl: null })

async function open(u: ShellUser) {
  renderWithQuery(<AccountMenu user={u} />)
  await userEvent.click(screen.getByRole("button", { name: "Account menu, Maria Santos" }))
}

describe("AccountMenu", () => {
  it("links to the dashboard of each role the user has", async () => {
    await open(user(["vendor", "organizer"]))

    expect(screen.getByRole("menuitem", { name: "Vendor dashboard" })).toHaveAttribute("href", "/vendor")
    expect(screen.getByRole("menuitem", { name: "Organizer dashboard" })).toHaveAttribute("href", "/organizer")
    expect(screen.queryByRole("menuitem", { name: /Become/ })).not.toBeInTheDocument()
  })

  it("offers the missing role instead of its dashboard", async () => {
    await open(user(["vendor"]))

    expect(screen.getByRole("menuitem", { name: "Vendor dashboard" })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Organizer dashboard" })).not.toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Become an organizer" })).toHaveAttribute("href", "/onboarding?role=organizer")
  })

  it("links admins to the admin area", async () => {
    await open(user([], true))

    expect(screen.getByRole("menuitem", { name: "Admin" })).toHaveAttribute("href", "/admin")
  })

  it("always has Account and Log out", async () => {
    await open(user([]))

    expect(screen.getByRole("menuitem", { name: "Account" })).toHaveAttribute("href", "/account")
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument()
  })
})
