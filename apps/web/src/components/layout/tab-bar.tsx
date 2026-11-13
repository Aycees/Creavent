import { cn } from "@/lib/utils"
import type { NavItem } from "./app-nav"
import { NavLink } from "./nav-link"

// `.tabbar`: the vendor's 72px bottom tab bar on phones (design brief §10).
export function TabBar({ label, items, className }: { label: string; items: NavItem[]; className?: string }) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "fixed inset-x-0 bottom-0 z-10 grid h-18 grid-cols-4 border-t border-border bg-surface pb-3",
        className
      )}
    >
      {items.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          exact={item.exact}
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] leading-[14px] font-medium text-muted no-underline data-active:text-ink"
        >
          <item.icon aria-hidden="true" className="size-6" />
          {item.shortLabel ?? item.label}
        </NavLink>
      ))}
    </nav>
  )
}
