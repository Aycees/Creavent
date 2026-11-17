"use client"

import { formatSchedule, REVIEW_TARGET_TEXT, type HostApproval, type PopupRow } from "@creavent/shared"
import { PlusIcon } from "@phosphor-icons/react"
import Link from "next/link"
import * as React from "react"

import { EventStatusBadge } from "@/components/events/parts"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateStamp } from "@/components/ui/date-stamp"
import { Tabs, TabCount, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { eventDays, stampDate } from "@/lib/event-format"
import { manilaDay, usePopups } from "./queries"

function HostButton() {
  return (
    <Button asChild>
      <Link href="/vendor/popups/new">
        <PlusIcon aria-hidden="true" />
        Host a pop-up
      </Link>
    </Button>
  )
}

// /vendor/popups (spec §4.7, flow 12, mockups P6Popups): the host's pop-ups
// in Upcoming and Past, and their host approval. Opening it checks the
// earned route, and says so once.
export function PopupsPage() {
  const { data, isError } = usePopups()
  if (isError) return <Alert tone="danger">We couldn&apos;t load your pop-ups. Refresh to try again.</Alert>
  if (!data) return <p role="status" className="text-sm text-muted">Loading…</p>
  const none = data.upcoming.length === 0 && data.past.length === 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1">Pop-ups</h1>
          <p className="text-sm text-muted">Your own stall: where and when people can find you.</p>
        </div>
        {!none && <HostButton />}
      </div>

      {data.host.justEarned && (
        <Alert tone="success">
          <span className="flex flex-col gap-1">
            <span className="font-semibold">You&apos;re approved to host pop-ups</span>
            <span>You&apos;ve sold at a Creavent event, so there&apos;s no review. Your pop-ups show &quot;Approved by Creavent&quot;.</span>
          </span>
        </Alert>
      )}

      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_300px] md:items-start md:gap-8">
        <div className="flex flex-col gap-4">
          {none ? (
            <section className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-5 md:p-6">
              <h2 className="text-h2">Host your own pop-up</h2>
              <p className="text-body text-muted">
                Tell people where and when to find your stall: a café corner, a garage sale, a weekend spot. It shows on
                the events page with your shop name.
              </p>
              <HostButton />
            </section>
          ) : (
            <Tabs defaultValue="upcoming">
              <TabsList aria-label="Your pop-ups">
                <TabsTrigger value="upcoming">
                  Upcoming <TabCount>{data.upcoming.length}</TabCount>
                </TabsTrigger>
                <TabsTrigger value="past">
                  Past <TabCount>{data.past.length}</TabCount>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="upcoming">
                <Rows rows={data.upcoming} empty="No upcoming pop-ups. Host one, or duplicate a past one." />
              </TabsContent>
              <TabsContent value="past">
                <Rows rows={data.past} empty="No past pop-ups yet." />
              </TabsContent>
            </Tabs>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <HostCard host={data.host} />
          {data.past.length > 0 && (
            <div className="flex flex-col gap-1 rounded-lg bg-sunken p-4">
              <p className="text-label font-semibold">Posting every week?</p>
              <p className="text-sm text-muted">Open a past pop-up and use Duplicate. You only pick new dates and hours.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

const hostBadges: Record<HostApproval["status"], { label: string; tone: React.ComponentProps<typeof Badge>["tone"] }> = {
  not_submitted: { label: "Not submitted", tone: "neutral" },
  pending_review: { label: "Pending review", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Not approved", tone: "danger" },
}

function HostCard({ host }: { host: HostApproval }) {
  const id = React.useId()
  const badge = host.revoked ? { label: "Revoked", tone: "danger" as const } : hostBadges[host.status]
  const text =
    host.status === "approved"
      ? host.source === "earned"
        ? `Earned${host.decidedAt ? ` ${manilaDay(host.decidedAt)}` : ""}: you sold at a Creavent event.`
        : `Approved${host.decidedAt ? ` ${manilaDay(host.decidedAt)}` : ""} after we reviewed your pages.`
      : host.status === "pending_review"
        ? `We're checking your shop's pages, usually in ${REVIEW_TARGET_TEXT}. Keep working on your drafts.`
        : host.status === "rejected"
          ? "See what to add, then resubmit. Your drafts are kept."
          : `You can write drafts now. To announce one, get approved once. We check your shop's social pages, usually in ${REVIEW_TARGET_TEXT}.`
  return (
    <section aria-labelledby={id} className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-4">
      <div className="flex w-full items-center justify-between gap-2">
        <h2 id={id} className="text-label font-semibold">
          Host approval
        </h2>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      <p className="text-sm text-muted">{text}</p>
      {host.status === "not_submitted" && (
        <p className="text-cap text-muted">Selling at a Creavent event first? You&apos;re approved automatically after it ends.</p>
      )}
      <Button asChild variant={host.status === "approved" || host.status === "pending_review" ? "secondary" : "brand"} className="mt-1">
        <Link href="/vendor/host-approval">{host.status === "approved" || host.status === "pending_review" ? "See details" : "Get approved"}</Link>
      </Button>
    </section>
  )
}

function Rows({ rows, empty }: { rows: PopupRow[]; empty: string }) {
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

function Row({ row: r }: { row: PopupRow }) {
  const id = React.useId()
  const days = eventDays(r)
  const action = r.status === "draft" ? "Continue" : r.status === "announced" ? "Edit" : "Open"
  const schedule = formatSchedule(r)
  return (
    <article aria-labelledby={id} className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-surface p-4 md:flex-nowrap md:items-center md:gap-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {r.startDate ? (
          <DateStamp date={stampDate(r.startDate)} endDay={days > 1 && r.endDate ? Number(r.endDate.slice(8)) : undefined} />
        ) : (
          <span className="grid h-15 w-14 flex-none place-items-center rounded-md border border-dashed border-border-strong text-center text-cap text-muted">
            No date
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id={id} className="text-label font-semibold">
            {r.name}
          </h3>
          <p className="text-cap text-muted">{[schedule, r.venueName].filter(Boolean).join(" · ") || "Dates and venue not set yet"}</p>
        </div>
      </div>
      <div className="order-3 flex w-full flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3 md:order-2 md:w-[300px] md:flex-none md:border-t-0 md:pt-0">
        <EventStatusBadge status={r.status} />
        {r.hidden && <Badge tone="danger">Hidden</Badge>}
        <span className="text-sm text-muted">{r.nextStep}</span>
      </div>
      <Button asChild variant="secondary" className="order-2 flex-none md:order-3">
        <Link href={`/vendor/popups/${r.id}`} aria-label={`${action} ${r.name}`}>
          {action}
        </Link>
      </Button>
    </article>
  )
}
