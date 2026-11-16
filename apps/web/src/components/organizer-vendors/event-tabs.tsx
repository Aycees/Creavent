import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { tabTriggerClass } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type Tab = "applications" | "vendors" | "setup"

// The header shared by an event's three pages: Applications, Vendors and
// slots, and Event setup (sitemap §4, mockup OrgEventSetup). The stamp and a
// status line sit with the name; `children` is the one next step and the
// More actions menu; the tabs are the navigation. A draft has no tabs, since
// it has no applications or vendors yet.
export function EventTabs({
  eventId,
  name,
  current,
  waiting,
  stamp,
  meta,
  nav = true,
  children,
}: {
  eventId: string
  name: string
  current: Tab
  waiting?: number
  stamp?: React.ReactNode
  meta?: React.ReactNode
  nav?: boolean
  children?: React.ReactNode
}) {
  const tabs = [
    { key: "applications", href: `/organizer/events/${eventId}/applications`, label: "Applications" },
    { key: "vendors", href: `/organizer/events/${eventId}/vendors`, label: "Vendors and slots" },
    { key: "setup", href: `/organizer/events/${eventId}`, label: "Event setup" },
  ] as const
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {stamp}
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-h1 text-balance">{name}</h1>
            {meta}
          </div>
        </div>
        {children && <div className="flex flex-none items-center gap-2 md:pt-1">{children}</div>}
      </div>
      {nav && (
      <nav aria-label="Event" className="-mx-4 flex overflow-x-auto border-b border-border px-4 [scrollbar-width:none] md:mx-0 md:px-0">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === current ? "page" : undefined}
            data-state={t.key === current ? "active" : "inactive"}
            className={cn(tabTriggerClass, "shrink-0")}
          >
            {t.label}
            {t.key === "applications" && waiting ? (
              <Badge tone="ink" dot={false}>{`${waiting} new`}</Badge>
            ) : null}
          </Link>
        ))}
      </nav>
      )}
    </div>
  )
}
