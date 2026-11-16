"use client"

import { REPORT_REASON_LABELS, REVIEW_TARGET_TEXT } from "@creavent/shared"
import Link from "next/link"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useApprovalQueue, useReportGroups } from "./queries"

const today = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "short", day: "numeric" })
const day = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" })

function Stat({ href, label, value, children }: { href: string; label: string; value: number; children?: React.ReactNode }) {
  return (
    <Link href={href} className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface px-5 py-4 text-ink no-underline shadow-sm hover:bg-sunken md:px-6 md:py-5">
      <span className="text-label text-muted">{label}</span>
      <span className="text-stat tabular-nums">{value}</span>
      {children && <span className="text-sm text-muted">{children}</span>}
    </Link>
  )
}

// /admin: counts, then the approval queue and open reports (sitemap §6, mockup AdminOverviewP5).
export function AdminOverview() {
  const { data: queue, isError: queueError } = useApprovalQueue()
  const { data: reports, isError: reportsError } = useReportGroups("open")
  const over = queue?.filter((q) => q.daysOverTarget > 0).length ?? 0
  const resubmissions = queue?.filter((q) => q.resubmission).length ?? 0
  const oldest = reports?.items[0]

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-cap font-semibold text-muted uppercase">{today.format(new Date())}</p>
        <h1 className="text-h1">Overview</h1>
      </div>
      {(queueError || reportsError) && <Alert tone="danger">We couldn&apos;t load everything. Refresh to try again.</Alert>}
      {queue && reports && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Stat href="/admin/approvals" label="Organizers waiting" value={queue.length}>
              {over > 0 ? <Badge tone="warning">{`${over} over target`}</Badge> : `Target ${REVIEW_TARGET_TEXT}`}
            </Stat>
            <Stat href="/admin/reports" label="Open reports" value={reports.openCount}>
              {oldest ? `Oldest from ${day.format(new Date(oldest.oldestAt))}` : "Nothing to review"}
            </Stat>
            <Stat href="/admin/approvals" label="Resubmissions" value={resubmissions}>
              Rejected once, sent new links
            </Stat>
          </div>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-h2">Approval queue</h2>
              {queue.length > 5 && (
                <Link href="/admin/approvals" className="text-sm">
                  See all {queue.length}
                </Link>
              )}
            </div>
            {queue.length === 0 ? (
              <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">No organizers are waiting for review.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                {queue.slice(0, 5).map((q) => (
                  <li key={q.userId}>
                    <Link href={`/admin/approvals/${q.userId}`} className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-3 no-underline hover:bg-sunken md:gap-4">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-label font-semibold text-ink">{q.displayName}</span>
                        <span className="text-cap text-muted">{`${q.linksCount} ${q.linksCount === 1 ? "link" : "links"} · ${day.format(new Date(q.submittedAt))}`}</span>
                      </span>
                      {q.resubmission && <Badge tone="info">Resubmitted</Badge>}
                      <Badge tone={q.daysOverTarget > 0 ? "warning" : "neutral"}>{`${q.businessDaysWaiting} business ${q.businessDaysWaiting === 1 ? "day" : "days"}`}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-h2">Open reports</h2>
              <Link href="/admin/reports" className="text-sm">
                See all
              </Link>
            </div>
            {reports.items.length === 0 ? (
              <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">No open reports.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                {reports.items.slice(0, 5).map((g) => (
                  <li key={g.id}>
                    <Link href={`/admin/reports/${g.id}`} className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-3 no-underline hover:bg-sunken md:gap-4">
                      <Badge dot={false}>{g.target.type === "event" ? "Event" : "User"}</Badge>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-label font-semibold text-ink">{g.target.name}</span>
                        <span className="text-cap text-muted">{`${g.count === 1 ? "1 report" : `${g.count} reports`} · ${g.reasons.map((r) => REPORT_REASON_LABELS[r]).join(", ")} · since ${day.format(new Date(g.oldestAt))}`}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
