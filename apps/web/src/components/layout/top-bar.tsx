import Link from "next/link"

import { AdminSearch } from "@/components/admin/admin-search"
import { Badge } from "@/components/ui/badge"
import { Logo } from "@/components/ui/logo"
import { Segmented, SegmentedItem } from "@/components/ui/segmented"
import type { ShellUser } from "@/lib/shell-user"
import { cn } from "@/lib/utils"
import { AccountMenu } from "./account-menu"
import { appNav, areaLabels, type Area } from "./app-nav"
import { Breadcrumb } from "./breadcrumb"

// `.rs`: shown only to users with both roles (design brief §10).
function RoleSwitch({ current }: { current: "vendor" | "organizer" }) {
  return (
    <Segmented role="group" aria-label="Switch role">
      <SegmentedItem asChild active={current === "vendor"} className="px-3 md:px-4">
        <Link href="/vendor">Vendor</Link>
      </SegmentedItem>
      <SegmentedItem asChild active={current === "organizer"} className="px-3 md:px-4">
        <Link href="/organizer">Organizer</Link>
      </SegmentedItem>
    </Segmented>
  )
}

// `.topbar`: 64px bar with the breadcrumb, role switch (or the Admin badge), and account menu.
// On phones the side menu's logo is hidden, so the logo shows here instead of the breadcrumb.
export function TopBar({ area, user, className }: { area: Area; user: ShellUser; className?: string }) {
  const hasBothRoles = user.roles.includes("vendor") && user.roles.includes("organizer")
  const crumbs = appNav[area].map(({ label, href, exact }) => ({ label, href, exact }))

  return (
    <div className={cn("flex h-16 items-center gap-2 border-b border-border bg-surface px-4 md:gap-4 md:px-8", className)}>
      <Logo className="md:hidden" />
      {area === "admin" ? (
        // Admins search users, organizers and events from every page (sitemap §5).
        <AdminSearch className="min-w-0 flex-1 md:max-w-[420px]" />
      ) : (
        <Breadcrumb area={areaLabels[area]} items={crumbs} className="hidden md:block" />
      )}
      <div className={cn("flex-1", area === "admin" && "max-md:hidden")} />
      {area === "admin" ? (
        <Badge tone="ink" dot={false} className="max-md:hidden">
          Admin
        </Badge>
      ) : (
        hasBothRoles && <RoleSwitch current={area} />
      )}
      <AccountMenu user={user} />
    </div>
  )
}
