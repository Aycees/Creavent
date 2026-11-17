"use client"

import type { AdminEventsFilter } from "@creavent/shared"
import Link from "next/link"
import * as React from "react"

import { EventStatusBadge } from "@/components/events/parts"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Chip } from "@/components/ui/chip"
import { DateStamp } from "@/components/ui/date-stamp"
import { SearchInput } from "@/components/ui/search-input"
import { Pager, useDebounced } from "./parts"
import { useAdminEvents } from "./queries"

const filters: { id: AdminEventsFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open to vendors" },
  { id: "announced", label: "Announced" },
  { id: "popups", label: "Pop-ups" },
  { id: "reported", label: "Reported" },
  { id: "hidden", label: "Hidden" },
  { id: "drafts", label: "Drafts" },
]

// /admin/events: every event, drafts and hidden ones included (sitemap §6, mockup AdminEventsP5).
export function AdminEventsList() {
  const [filter, setFilter] = React.useState<AdminEventsFilter>("all")
  const [q, setQ] = React.useState("")
  const [page, setPage] = React.useState(1)
  const term = useDebounced(q.trim())
  const { data, isError } = useAdminEvents({ ...(term ? { q: term } : {}), filter, page })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">Events</h1>
        <p className="text-sm text-muted">Every event on Creavent, including drafts and hidden ones</p>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <SearchInput aria-label="Search events" placeholder="Event, organizer or shop name" className="md:w-80" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {filters.map((f) => (
            <Chip key={f.id} pressed={filter === f.id} count={data?.counts[f.id]} onClick={() => (setFilter(f.id), setPage(1))}>
              {f.label}
            </Chip>
          ))}
        </div>
      </div>
      {isError && <Alert tone="danger">We couldn&apos;t load events. Refresh to try again.</Alert>}
      {data?.items.length === 0 && <p className="rounded-lg border border-border bg-surface p-6 text-sm text-muted">No events match.</p>}
      {data && data.items.length > 0 && (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {data.items.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/events/${e.id}`} className="flex min-h-16 flex-col gap-2 px-4 py-3 no-underline hover:bg-sunken md:flex-row md:items-center md:gap-4">
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  {e.startsAt && <DateStamp date={new Date(e.startsAt)} size="sm" />}
                  <span className="flex min-w-0 flex-col">
                    <span className="text-label font-semibold text-ink">{e.name}</span>
                    <span className="truncate text-cap text-muted">
                      {/* A pop-up is listed with its host (spec §4.7). */}
                      {(e.isPopup ? [`Pop-up · host ${e.organizerName}`, e.venueName] : [e.organizerName, e.typeName, e.venueName]).filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <EventStatusBadge status={e.status} />
                  {e.hidden && <Badge tone="danger">Hidden</Badge>}
                  {e.openReports > 0 && <Badge tone="warning">{e.openReports === 1 ? "1 report" : `${e.openReports} reports`}</Badge>}
                  {!e.isPopup && (
                    <span className="text-cap text-muted tabular-nums">
                      {e.slots ? `${e.confirmed} of ${e.slots} confirmed` : "No slots yet"}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
    </div>
  )
}
