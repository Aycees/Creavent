import { renderWithQuery as render } from "@/test-utils"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { usePathname } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AppShell } from "./app-shell"

vi.mock("next/navigation", () => ({ usePathname: vi.fn(), useRouter: () => ({ replace: vi.fn() }) }))

const bothRoles = { name: "Lola's Ukay", initials: "LU", roles: ["vendor", "organizer"] as const }
const vendorOnly = { name: "Lola's Ukay", initials: "LU", roles: ["vendor"] as const }

function onPath(path: string) {
  vi.mocked(usePathname).mockReturnValue(path)
}

beforeEach(() => onPath("/vendor"))

describe("AppShell, vendor area", () => {
  it("shows the vendor menu items", () => {
    render(<AppShell area="vendor" user={bothRoles}>Page</AppShell>)
    const menu = screen.getByRole("navigation", { name: "Vendor menu" })

    expect(within(menu).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/vendor")
    expect(within(menu).getByRole("link", { name: "Browse events" })).toHaveAttribute("href", "/vendor/events")
    expect(within(menu).getByRole("link", { name: "Applications" })).toHaveAttribute("href", "/vendor/applications")
    expect(within(menu).getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/vendor/profile")
  })

  it("marks the section of the current page, including its detail pages", () => {
    onPath("/vendor/applications/42")
    render(<AppShell area="vendor" user={bothRoles}>Page</AppShell>)
    const menu = screen.getByRole("navigation", { name: "Vendor menu" })

    expect(within(menu).getByRole("link", { name: "Applications" })).toHaveAttribute("aria-current", "page")
    expect(within(menu).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current")
  })

  it("shows the phone tab bar with Dashboard, Browse, Applications, and Profile", () => {
    onPath("/vendor/events")
    render(<AppShell area="vendor" user={bothRoles}>Page</AppShell>)
    const tabs = screen.getByRole("navigation", { name: "Vendor tabs" })

    expect(within(tabs).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Dashboard",
      "Browse",
      "Applications",
      "Profile",
    ])
    expect(within(tabs).getByRole("link", { name: "Browse" })).toHaveAttribute("aria-current", "page")
  })

  it("shows the breadcrumb with the area and the current section", () => {
    onPath("/vendor/applications")
    render(<AppShell area="vendor" user={bothRoles}>Page</AppShell>)
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" })

    expect(within(breadcrumb).getByText("Vendor")).toBeInTheDocument()
    expect(within(breadcrumb).getByText("Applications")).toHaveAttribute("aria-current", "page")
  })

  it("renders the page content in the main landmark", () => {
    render(<AppShell area="vendor" user={bothRoles}>Page content</AppShell>)

    expect(screen.getByRole("main")).toHaveTextContent("Page content")
  })
})

describe("AppShell, role switch", () => {
  it("shows the role switch to users with both roles, with the current role marked", () => {
    onPath("/organizer")
    render(<AppShell area="organizer" user={bothRoles}>Page</AppShell>)
    const roleSwitch = screen.getByRole("group", { name: "Switch role" })

    expect(within(roleSwitch).getByRole("link", { name: "Vendor" })).toHaveAttribute("href", "/vendor")
    expect(within(roleSwitch).getByRole("link", { name: "Organizer" })).toHaveAttribute("aria-current", "page")
  })

  it("hides the role switch from users with one role", () => {
    render(<AppShell area="vendor" user={vendorOnly}>Page</AppShell>)

    expect(screen.queryByRole("group", { name: "Switch role" })).not.toBeInTheDocument()
  })
})

describe("AppShell, organizer area", () => {
  it("shows the organizer menu items with their counts and approval status", () => {
    onPath("/organizer/events/new")
    render(
      <AppShell area="organizer" user={bothRoles} counts={{ "/organizer/events": 4, "/organizer/applications": 7, "/organizer/approval": "Approved" }}>
        Page
      </AppShell>
    )
    const menu = screen.getByRole("navigation", { name: "Organizer menu" })

    expect(within(menu).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/organizer")
    expect(within(menu).getByRole("link", { name: "Events 4" })).toHaveAttribute("aria-current", "page")
    expect(within(menu).getByRole("link", { name: "Applications 7" })).toHaveAttribute("href", "/organizer/applications")
    expect(within(menu).getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/organizer/profile")
    expect(within(menu).getByRole("link", { name: "Approval Approved" })).toHaveAttribute("href", "/organizer/approval")
  })

  it("has no vendor tab bar", () => {
    onPath("/organizer")
    render(<AppShell area="organizer" user={bothRoles}>Page</AppShell>)

    expect(screen.queryByRole("navigation", { name: "Vendor tabs" })).not.toBeInTheDocument()
  })
})

describe("AppShell, admin area", () => {
  it("shows the Admin badge instead of the role switch", () => {
    onPath("/admin")
    render(<AppShell area="admin" user={bothRoles}>Page</AppShell>)

    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0)
    expect(screen.queryByRole("group", { name: "Switch role" })).not.toBeInTheDocument()
  })

  it("shows the admin menu items with counts on Approvals and Reports", () => {
    onPath("/admin")
    render(
      <AppShell area="admin" user={bothRoles} counts={{ "/admin/approvals": 7, "/admin/reports": 3 }}>
        Page
      </AppShell>
    )
    const menu = screen.getByRole("navigation", { name: "Admin menu" })

    expect(within(menu).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page")
    expect(within(menu).getByRole("link", { name: "Approvals 7" })).toHaveAttribute("href", "/admin/approvals")
    expect(within(menu).getByRole("link", { name: "Reports 3" })).toHaveAttribute("href", "/admin/reports")
    expect(within(menu).getByRole("link", { name: "Users" })).toHaveAttribute("href", "/admin/users")
    expect(within(menu).getByRole("link", { name: "Events" })).toHaveAttribute("href", "/admin/events")
  })
})

describe("AppShell, account menu", () => {
  it("opens the account menu from the avatar button", async () => {
    render(<AppShell area="vendor" user={vendorOnly}>Page</AppShell>)

    await userEvent.click(screen.getByRole("button", { name: "Account menu, Lola's Ukay" }))

    expect(screen.getByRole("menuitem", { name: "Account" })).toHaveAttribute("href", "/account")
    expect(screen.getByRole("menuitem", { name: "Become an organizer" })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Become a vendor" })).not.toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument()
  })
})
