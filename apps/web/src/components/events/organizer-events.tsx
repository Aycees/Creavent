"use client"

import { formatPeso, type OrganizerEventRow, type OrganizerEvents, type OrganizerTodo } from "@creavent/shared"
import { PlusIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateStamp } from "@/components/ui/date-stamp"
import { Tabs, TabCount, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api"
import { eventDays, stampDate } from "@/lib/event-format"
import { EventStatusBadge } from "./parts"

function useOrganizerEvents() {
  return useQuery({
    queryKey: ["organizer-events"],
    queryFn: async (): Promise<OrganizerEvents> => {
      const { data, response } = await api.GET("/api/organizer/events")
      if (!data) throw new Error(`GET /api/organizer/events failed with ${response.status}`)
      return data
    },
  })
}

// To-do counts per event, then "Your events" in Upcoming and Past tabs
// (spec §3.8, mockup OrgDashboard).
export function OrganizerEventsList({ title }: { title: string }) {
  const { data, isError } = useOrganizerEvents()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">{title}</h1>
        <Button asChild>
          <Link href="/organizer/events/new">
            <PlusIcon aria-hidden="true" />
            Create event
          </Link>
        </Button>
      </div>

      {isError && <Alert tone="danger">We couldn&apos;t load your events. Refresh to try again.</Alert>}
      {!data && !isError && <p role="status" className="text-sm text-muted">Loading…</p>}
      {data?.todo.map((t) => <Todo key={t.eventId} todo={t} />)}
      {data && (
        <section aria-label="Your events" className="flex flex-col gap-4">
          <h2 className="text-h2">Your events</h2>
          <Tabs defaultValue="upcoming">
            <TabsList aria-label="Your events">
              <TabsTrigger value="upcoming">
                Upcoming <TabCount>{data.upcoming.length}</TabCount>
              </TabsTrigger>
              <TabsTrigger value="past">
                Past <TabCount>{data.past.length}</TabCount>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming">
              <Rows rows={data.upcoming} empty="No upcoming events. Create a draft to get started." />
            </TabsContent>
            <TabsContent value="past">
              <Rows rows={data.past} empty="No past events yet." />
            </TabsContent>
          </Tabs>
        </section>
      )}
    </div>
  )
}

function Rows({ rows, empty }: { rows: OrganizerEventRow[]; empty: string }) {
  if (rows.length === 0) return <p className="rounded-lg border border-dashed border-border-strong p-8 text-center text-sm text-muted">{empty}</p>
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.id}>
          <Row row={r} />
        </li>
      ))}
    </ul>
  )
}

function slotsText(r: OrganizerEventRow) {
  if (r.fill) return `${r.fill.reserved} reserved · ${r.fill.assigned} assigned · ${r.fill.open} open`
  const count = `${r.slotCount} ${r.slotCount === 1 ? "slot" : "slots"}`
  return r.status === "draft" ? `${count} · not open to vendors yet` : count
}

function Row({ row: r }: { row: OrganizerEventRow }) {
  const id = React.useId()
  const days = eventDays({ ...r, opensAt: null, closesAt: null })
  const action = r.status === "draft" ? "Edit" : "Manage"
  return (
    // Phones: the date, name and action share the first line, the status facts
    // run underneath. Desktop: one line, with the facts in a fixed column.
    <article aria-labelledby={id} className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-surface p-4 md:flex-nowrap md:items-center md:gap-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {r.startDate ? (
          <DateStamp date={stampDate(r.startDate)} endDay={days > 1 && r.endDate ? Number(r.endDate.slice(8)) : undefined} />
        ) : (
          <span className="grid h-15 w-14 flex-none place-items-center rounded-md border border-dashed border-border-strong text-cap text-muted">TBA</span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id={id} className="text-label font-semibold">
            {r.name}
          </h3>
          <p className="text-cap text-muted">{[r.typeName, r.venueName].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 md:order-2 md:w-[420px] md:flex-none md:border-t-0 md:pt-0">
        <EventStatusBadge status={r.status} />
        <span className="text-sm text-muted">{slotsText(r)}</span>
        {r.nextStep && (
          <Badge tone={r.status === "draft" ? "warning" : "neutral"} dot={false}>
            {r.nextStep}
          </Badge>
        )}
      </div>
      <Button asChild variant="secondary" className="order-2 flex-none md:order-3">
        <Link href={`/organizer/events/${r.id}`} aria-label={`${action} ${r.name}`}>
          {action}
        </Link>
      </Button>
    </article>
  )
}

const shortDay = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" })

// "To do for Bajada Christmas Flea": each count links to the page that
// handles it (spec §3.8).
function Todo({ todo: t }: { todo: OrganizerTodo }) {
  const id = React.useId()
  const base = `/organizer/events/${t.eventId}`
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const items = [
    t.applicationsToReview > 0 && {
      href: `${base}/applications`,
      label: plural(t.applicationsToReview, "application to review", "applications to review"),
      detail: t.oldestApplicationAt ? `Oldest from ${shortDay.format(new Date(t.oldestApplicationAt))}` : null,
    },
    t.proofsToCheck > 0 && { href: `${base}/vendors`, label: plural(t.proofsToCheck, "payment proof to check", "payment proofs to check"), detail: `${formatPeso(t.proofsTotal)} in total` },
    t.overduePayments > 0 && { href: `${base}/vendors`, label: plural(t.overduePayments, "payment overdue", "payments overdue"), detail: "Wait, or remove the vendor", warn: true },
    t.approvedNoSlot > 0 && { href: `${base}/vendors`, label: `${t.approvedNoSlot} approved, no slot yet`, detail: plural(t.openSlots, "slot open", "slots open") },
  ].filter(Boolean) as { href: string; label: string; detail: string | null; warn?: boolean }[]
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5">
      <h2 id={id} className="text-h3">{`To do for ${t.name}`}</h2>
      <ul className="grid gap-2 md:grid-cols-2">
        {items.map((i) => (
          <li key={i.label}>
            <Link href={i.href} className={`flex min-h-11 flex-col rounded-md px-4 py-3 hover:bg-sunken ${i.warn ? "bg-warning-soft text-warning-ink" : "bg-canvas"}`}>
              <span className="text-label font-semibold">{i.label}</span>
              {i.detail && <span className="text-cap">{i.detail}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
