import type { Icon } from "@phosphor-icons/react"
import {
  CalendarBlankIcon,
  FileTextIcon,
  FlagIcon,
  MagnifyingGlassIcon,
  SealCheckIcon,
  ShieldCheckIcon,
  SquaresFourIcon,
  StorefrontIcon,
  UserCircleIcon,
  UsersIcon,
} from "@phosphor-icons/react/dist/ssr"

export type Area = "vendor" | "organizer" | "admin"

export type NavItem = {
  label: string
  /** Shorter label for the phone tab bar. */
  shortLabel?: string
  href: string
  exact?: boolean
  icon: Icon
}

export const areaLabels: Record<Area, string> = {
  vendor: "Vendor",
  organizer: "Organizer",
  admin: "Admin",
}

// Main menu for each signed-in area (sitemap §5).
export const appNav: Record<Area, NavItem[]> = {
  vendor: [
    { label: "Dashboard", href: "/vendor", exact: true, icon: SquaresFourIcon },
    { label: "Browse events", shortLabel: "Browse", href: "/vendor/events", icon: MagnifyingGlassIcon },
    { label: "Applications", href: "/vendor/applications", icon: FileTextIcon },
    { label: "Profile", href: "/vendor/profile", icon: StorefrontIcon },
  ],
  organizer: [
    { label: "Dashboard", href: "/organizer", exact: true, icon: SquaresFourIcon },
    { label: "Events", href: "/organizer/events", icon: CalendarBlankIcon },
    { label: "Profile", href: "/organizer/profile", icon: UserCircleIcon },
    { label: "Approval", href: "/organizer/approval", icon: ShieldCheckIcon },
  ],
  admin: [
    { label: "Overview", href: "/admin", exact: true, icon: SquaresFourIcon },
    { label: "Approvals", href: "/admin/approvals", icon: SealCheckIcon },
    { label: "Reports", href: "/admin/reports", icon: FlagIcon },
    { label: "Users", href: "/admin/users", icon: UsersIcon },
    { label: "Events", href: "/admin/events", icon: CalendarBlankIcon },
  ],
}
