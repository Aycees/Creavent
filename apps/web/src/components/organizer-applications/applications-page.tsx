"use client"

import { formatPeso, type ApplicationCard, type ApplicationFilter } from "@creavent/shared"
import { ClockIcon, FileTextIcon, GridFourIcon, WarningIcon } from "@phosphor-icons/react"
import Link from "next/link"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Chip } from "@/components/ui/chip"
import { inputClass } from "@/components/ui/input"
import { SearchInput } from "@/components/ui/search-input"
import { formatDay } from "@/lib/event-format"
import { cn } from "@/lib/utils"
import { ago, manilaDay, useOrganizerApplications, waitingFor } from "./queries"

const filters: { key: ApplicationFilter; label: string }[] = [
  { key: "waiting", label: "Waiting" },
  { key: "approved_no_slot", label: "Approved, no slot" },
  { key: "slot_assigned", label: "Slot assigned" },
  { key: "reserved", label: "Reserved" },
  { key: "declined", label: "Declined" },
  { key: "withdrawn", label: "Withdrawn" },
  { key: "removed", label: "Removed" },
  { key: "all", label: "All" },
]

const stageLabels: Record<ApplicationCard["stage"], string> = {
  submitted: "Waiting",
  approved: "Approved, no slot",
  slot_assigned: "Slot assigned",
  reserved: "Reserved",
  declined: "Declined",
  withdrawn: "Withdrawn",
  removed: "Removed",
}

// /organizer/applications: every application across the organizer's events
// (decided 2026-11-15, mockup OrgApplications).
export function OrganizerApplicationsPage() {
  const [status, setStatus] = React.useState<ApplicationFilter>("waiting")
  const [eventId, setEventId] = React.useState("")
  const [q, setQ] = React.useState("")
  const query = { status, ...(eventId ? { eventId } : {}), ...(q.trim() ? { q: q.trim() } : {}) }
  const { data, isError } = useOrganizerApplications(query)
  const [now] = React.useState(() => Date.now())

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-h1">Applications</h1>
        <p className="text-body text-muted">Every vendor who applied to your events. Waiting ones first, oldest at the top.</p>
      </div>
      {isError && <Alert tone="danger">We couldn&apos;t load the applications. Refresh to try again.</Alert>}
      {!data && !isError && <p role="status" className="text-sm text-muted">Loading…</p>}
      {data && (
        <>
          {/* Phones: a compact row that scrolls sideways. Desktop: three cards. */}
          <section aria-label="What needs you" className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:px-0">
            <button type="button" onClick={() => setStatus("waiting")} className="flex min-w-[220px] snap-start flex-col items-start gap-0.5 rounded-lg border border-border bg-surface px-4 py-3 text-left md:min-w-0">
              <span className="text-stat tabular-nums">{data.summary.waiting}</span>
              <span className="text-label">Waiting for your review</span>
              <span className="text-cap text-muted">
                {data.summary.oldestWaitingAt
                  ? `Oldest from ${manilaDay(data.summary.oldestWaitingAt)}, ${ago(data.summary.oldestWaitingAt, now)}`
                  : "None right now"}
              </span>
            </button>
            <button type="button" onClick={() => setStatus("approved_no_slot")} className="flex min-w-[220px] snap-start flex-col items-start gap-0.5 rounded-lg border border-border bg-surface px-4 py-3 text-left md:min-w-0">
              <span className="text-stat tabular-nums">{data.summary.approvedNoSlot}</span>
              <span className="text-label">Approved, no slot yet</span>
              <span className="text-cap text-muted">{`${data.summary.openSlots} slots open across your events`}</span>
            </button>
            <button
              type="button"
              onClick={() => setStatus("slot_assigned")}
              className={cn("flex min-w-[220px] snap-start flex-col items-start gap-0.5 rounded-lg border px-4 py-3 text-left md:min-w-0", data.summary.proofsToCheck ? "border-warning-soft bg-warning-soft text-warning-ink" : "border-border bg-surface")}
            >
              <span className="text-stat tabular-nums">{data.summary.proofsToCheck}</span>
              <span className="text-label">Payment proofs to check</span>
              <span className="text-cap">{data.summary.proofsToCheck ? `${formatPeso(data.summary.proofsTotal)} in total` : "Nothing to check"}</span>
            </button>
          </section>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row">
              <SearchInput aria-label="Search by shop name" placeholder="Search by shop name" value={q} onChange={(e) => setQ(e.target.value)} className="md:flex-1" />
              <label className="sr-only" htmlFor="app-event">Event</label>
              <select id="app-event" className={cn(inputClass, "md:w-72")} value={eventId} onChange={(e) => setEventId(e.target.value)}>
                <option value="">{`All events (${data.events.length} taking vendors)`}</option>
                {data.events.map((e) => (
                  <option key={e.id} value={e.id}>{`${e.name}${e.startDate ? ` · ${formatDay(e.startDate)}` : ""}`}</option>
                ))}
              </select>
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Status">
              {filters.map((f) => (
                <Chip key={f.key} pressed={status === f.key} count={data.counts[f.key]} onClick={() => setStatus(f.key)}>
                  {f.label}
                </Chip>
              ))}
            </div>
          </div>

          {data.applications.length === 0 ? (
            <p className="text-body text-muted">
              {status === "waiting" ? "Nothing waiting. New applications show up here, and we email you each one." : "None here."}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.applications.map((a) => (
                <li key={a.id}>
                  <Card card={a} now={now} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function Card({ card: a, now }: { card: ApplicationCard; now: number }) {
  const id = React.useId()
  const initials = a.shopName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  const docs = a.documents.count === 0 ? "No documents" : `${a.documents.count} document${a.documents.count > 1 ? "s" : ""}${a.documents.pdfs ? `, ${a.documents.pdfs} PDF` : ""}`
  return (
    <article aria-labelledby={id} className="relative flex gap-4 rounded-lg border border-border bg-surface p-4 hover:border-border-strong md:px-5">
      {a.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized
        <img src={a.avatarUrl} alt="" className="size-11 flex-none rounded-pill object-cover md:size-14" />
      ) : (
        <span aria-hidden="true" className="grid size-11 flex-none place-items-center rounded-pill bg-sunken text-label font-semibold md:size-14">{initials}</span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 id={id} className="text-h3">
            <Link href={`/organizer/applications/${a.id}`} className="after:absolute after:inset-0 after:rounded-lg hover:underline">
              {a.shopName}
            </Link>
          </h2>
          <span className="text-cap text-muted">{`${a.eventName}${a.eventStartDate ? ` · ${formatDay(a.eventStartDate)}` : ""}`}</span>
          {a.stage !== "submitted" && <span className="rounded-pill bg-sunken px-2.5 py-0.5 text-cap">{stageLabels[a.stage]}</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {a.categories.map((c) => (
            <span key={c} className="rounded-sm bg-sunken px-2 py-0.5 text-cap">{c}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5"><FileTextIcon aria-hidden="true" className="size-4" />{docs}</span>
          {a.documents.missing.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-danger-ink"><WarningIcon aria-hidden="true" className="size-4" />{`${a.documents.missing.join(", ")} missing`}</span>
          )}
          {a.stage === "submitted" && <span className="inline-flex items-center gap-1.5 text-muted"><ClockIcon aria-hidden="true" className="size-4" />{waitingFor(a.submittedAt, now)}</span>}
          {(a.slotLabel || a.preferredSlot) && (
            <span className="inline-flex items-center gap-1.5">
              <GridFourIcon aria-hidden="true" className="size-4" />
              <span className="font-mono">{a.slotLabel ?? a.preferredSlot!.label}</span>
              {!a.slotLabel && a.preferredSlot && (
                <span className="text-muted">{a.preferredSlot.state === "open" ? "preferred, open" : a.preferredSlot.state === "taken" ? "preferred, taken" : "no longer available"}</span>
              )}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
