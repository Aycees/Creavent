import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { tabTriggerClass } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type Tab = "applications" | "vendors"

// The header of an event's Applications and Vendors and slots pages, with
// the tabs that join them to Event setup (sitemap §4, mockup OrgVendors).
export function EventTabs({
  eventId,
  name,
  current,
  waiting,
  children,
}: {
  eventId: string
  name: string
  current: Tab
  waiting?: number
  children?: React.ReactNode
}) {
  const tabs = [
    { key: "applications", href: `/organizer/events/${eventId}/applications`, label: "Applications" },
    { key: "vendors", href: `/organizer/events/${eventId}/vendors`, label: "Vendors and slots" },
    { key: "setup", href: `/organizer/events/${eventId}`, label: "Event setup" },
  ] as const
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="min-w-0 flex-[1_1_240px] text-h1">{name}</h1>
        {children}
      </div>
      <nav aria-label="Event" className="-mx-4 flex overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
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
    </div>
  )
}
