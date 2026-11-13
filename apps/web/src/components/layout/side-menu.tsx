import { Logo } from "@/components/ui/logo"
import { cn } from "@/lib/utils"
import { areaLabels, type Area, type NavItem } from "./app-nav"
import { NavLink } from "./nav-link"

// `.side`: 240px side menu on desktop. On phones it becomes a row that scrolls sideways.
export function SideMenu({
  area,
  items,
  counts = {},
  className,
}: {
  area: Area
  items: NavItem[]
  counts?: Record<string, string | number>
  className?: string
}) {
  return (
    <nav
      aria-label={`${areaLabels[area]} menu`}
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-border bg-surface px-4 py-2 [scrollbar-width:none] md:flex-col md:overflow-visible md:border-r md:border-b-0 md:px-4 md:py-5",
        className
      )}
    >
      <Logo className="mb-5 hidden px-3 py-1.5 md:inline-flex" />
      {items.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          exact={item.exact}
          className="flex h-11 shrink-0 items-center gap-3 rounded-md px-3 text-label whitespace-nowrap text-muted no-underline hover:text-ink data-active:bg-sunken data-active:font-semibold data-active:text-ink"
        >
          <item.icon aria-hidden="true" className="size-5" />
          {item.label}
          {counts[item.href] !== undefined && (
            <>
              {" "}
              <span className="ml-auto text-cap text-muted tabular-nums">{counts[item.href]}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
