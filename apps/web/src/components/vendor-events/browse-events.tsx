"use client"

import { eventCities, vendorStatusLabels, type VendorEventCard } from "@creavent/shared"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { ApprovedMark } from "@/components/ui/approved-mark"
import { Badge } from "@/components/ui/badge"
import { Chip } from "@/components/ui/chip"
import { DateStamp } from "@/components/ui/date-stamp"
import { inputClass } from "@/components/ui/input"
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder"
import { SearchInput } from "@/components/ui/search-input"
import { api } from "@/lib/api"
import { eventDays, formatDateTime, formatSchedule, stampDate } from "@/lib/event-format"
import { cn } from "@/lib/utils"

type When = "any" | "weekend" | "30d"
const whenLabels: Record<When, string> = { any: "Any date", weekend: "This weekend", "30d": "Next 30 days" }

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

// /vendor/events (spec §4.2, mockup VendorBrowse): events open to vendors or
// announced, soonest first.
export function BrowseEvents() {
  const [q, setQ] = React.useState("")
  const [when, setWhen] = React.useState<When>("any")
  const [city, setCity] = React.useState("")
  const search = useDebounced(q.trim(), 300)
  const query = { ...(search ? { q: search } : {}), ...(when !== "any" ? { when } : {}), ...(city ? { city } : {}) }
  const { data, isError } = useQuery({
    queryKey: ["vendor-events", query],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<VendorEventCard[]> => {
      const { data, response } = await api.GET("/api/vendor/events", { params: { query } })
      if (!data) throw new Error(`GET /api/vendor/events failed with ${response.status}`)
      return data.events
    },
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">Browse events</h1>
        <p className="text-sm text-muted">Events open to vendors or already announced. Spots left are for your categories.</p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <SearchInput aria-label="Search events" placeholder="Search events or venues" value={q} onChange={(e) => setQ(e.target.value)} className="md:w-80" />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
          {(Object.keys(whenLabels) as When[]).map((w) => (
            <Chip key={w} pressed={when === w} onClick={() => setWhen(w)}>
              {whenLabels[w]}
            </Chip>
          ))}
        </div>
        <label className="flex items-center gap-2 text-label md:ml-auto">
          City
          <select className={cn(inputClass, "h-11 w-auto")} value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">All cities</option>
            {eventCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isError && <Alert tone="danger">We couldn&apos;t load events. Refresh to try again.</Alert>}
      {!data && !isError && <p role="status" className="text-sm text-muted">Loading…</p>}
      {data && (
        <>
          <p className="text-sm text-muted">
            {data.length} {data.length === 1 ? "event" : "events"}, soonest first
          </p>
          {data.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-strong p-8 text-center text-sm text-muted">No events match. Try another date or city.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {data.map((e) => (
                <li key={e.slug}>
                  <EventCard event={e} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function EventCard({ event: e }: { event: VendorEventCard }) {
  const id = React.useId()
  const schedule = formatSchedule(e)
  const days = eventDays(e)
  return (
    // The title link stretches over the whole card, so a tap anywhere opens the
    // event while it stays one link for keyboards and screen readers.
    <article
      aria-labelledby={id}
      className="relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-border-strong hover:bg-canvas has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus md:flex-row md:gap-5 md:overflow-visible md:p-5"
    >
      {/* The cover as the organizer framed it (16:9), full width on phones and
          a thumbnail beside the details on desktop. The date stamp sits on it. */}
      <div className="relative md:w-48 md:flex-none md:self-start md:overflow-hidden md:rounded-md">
        {e.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized
          <img src={e.coverUrl} alt="" loading="lazy" className="aspect-video w-full bg-sunken object-cover" />
        ) : (
          <PhotoPlaceholder />
        )}
        {e.startDate && (
          <DateStamp
            date={stampDate(e.startDate)}
            endDay={days > 1 && e.endDate ? Number(e.endDate.slice(8)) : undefined}
            className="absolute bottom-3 left-3 shadow-sm md:bottom-2 md:left-2"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 md:flex-row md:flex-wrap md:gap-5 md:p-0">
        <div className="flex min-w-0 flex-1 flex-col gap-2 md:basis-60">
          <div className="flex flex-wrap items-center gap-2">
            <Badge dot={false}>{e.typeName}</Badge>
            <Badge tone={e.status === "announced" ? "success" : "info"}>{e.status === "announced" ? "Announced" : "Open to vendors"}</Badge>
            {e.preferredSlots && (
              <Badge tone="today" dot={false}>
                Choose a preferred slot
              </Badge>
            )}
            {e.myStatus && <Badge tone="neutral">{`You: ${vendorStatusLabels[e.myStatus]}`}</Badge>}
          </div>
          <h2 id={id} className="text-h3">
            <Link href={`/events/${e.slug}`} className="outline-none after:absolute after:inset-0 after:rounded-lg">
              {e.name}
            </Link>
          </h2>
          <p className="text-sm text-muted">{[schedule, e.venueName].filter(Boolean).join(" · ")}</p>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            {e.organizer.displayName}
            {e.organizer.approved && <ApprovedMark compact link={false} />}
          </p>
          {e.mySpots.map((s) => (
            <p key={s.categoryName} className="text-sm font-medium">
              {`${s.categoryName}: ${s.left} of ${s.max} spots left`}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-1 border-t border-border pt-3 md:w-56 md:border-t-0 md:border-l md:pt-0 md:pl-5">
          <p className="text-cap text-muted">Slot fee</p>
          <p className="text-price tabular-nums">{e.feeRange ?? "Not set"}</p>
          <p className="text-cap text-muted">
            {!e.acceptingApplications
              ? "Applications closed"
              : e.applicationsCloseAt
                ? `Applications close ${formatDateTime(e.applicationsCloseAt)}`
                : "Applications open"}
          </p>
        </div>
      </div>
    </article>
  )
}
