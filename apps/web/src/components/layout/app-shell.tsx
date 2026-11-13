import * as React from "react"

import type { ShellUser } from "@/lib/shell-user"
import { cn } from "@/lib/utils"
import { appNav, areaLabels, type Area } from "./app-nav"
import { SideMenu } from "./side-menu"
import { SiteFooter } from "./site-footer"
import { TabBar } from "./tab-bar"
import { TopBar } from "./top-bar"

// Signed-in shell for the vendor, organizer, and admin areas (design brief §7).
// Phone: top bar, then the menu as a sideways-scrolling row (vendors get the bottom tab bar
// instead), then the content. Desktop: 240px side menu beside the top bar and content.
export function AppShell({
  area,
  user,
  counts,
  children,
}: {
  area: Area
  user: ShellUser
  counts?: Record<string, string | number>
  children: React.ReactNode
}) {
  const items = appNav[area]
  const isVendor = area === "vendor"

  return (
    <div className="flex min-h-dvh flex-col md:grid md:grid-cols-[240px_minmax(0,1fr)] md:grid-rows-[auto_1fr]">
      <TopBar area={area} user={user} className="md:col-start-2 md:row-start-1" />
      <SideMenu
        area={area}
        items={items}
        counts={counts}
        className={cn("md:col-start-1 md:row-span-2 md:row-start-1", isVendor && "hidden md:flex")}
      />
      <div className={cn("flex min-w-0 flex-1 flex-col md:col-start-2", isVendor && "pb-18 md:pb-0")}>
        <main className="w-full max-w-app flex-1 p-4 md:p-8">{children}</main>
        <SiteFooter />
      </div>
      {isVendor && <TabBar label={`${areaLabels[area]} tabs`} items={items} className="md:hidden" />}
    </div>
  )
}
