"use client"

import { REVIEW_TARGET_TEXT, type ApprovalQueueItem } from "@creavent/shared"
import Link from "next/link"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useApprovalQueue } from "./queries"

function waiting(item: ApprovalQueueItem) {
  const days = item.businessDaysWaiting
  return { label: days === 0 ? "Submitted today" : `Waiting ${days} business ${days === 1 ? "day" : "days"}`, over: item.daysOverTarget }
}

// /admin/approvals: organizers waiting for review, oldest first (sitemap §6).
export function ApprovalQueue() {
  const { data: items, isError } = useApprovalQueue()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">Approvals</h1>
        <p className="text-body text-muted">Organizers waiting for review, oldest first. The target is {REVIEW_TARGET_TEXT}.</p>
      </div>
      {isError && <Alert tone="danger">We couldn&apos;t load the queue. Refresh to try again.</Alert>}
      {items?.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-6 text-sm text-muted">No organizers are waiting for review.</p>
      )}
      {items && items.length > 0 && (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {items.map((item) => {
            const w = waiting(item)
            return (
              <li key={item.userId}>
                <Link
                  href={`/admin/approvals/${item.userId}`}
                  className="flex min-h-16 flex-col gap-1 px-4 py-3 no-underline hover:bg-sunken md:flex-row md:items-center md:gap-4"
                >
                  <span className="flex flex-1 flex-col">
                    <span className="text-label font-semibold text-ink">{item.displayName}</span>
                    <span className="text-cap text-muted">
                      {[item.city, `${item.linksCount} ${item.linksCount === 1 ? "link" : "links"}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {item.resubmission && <Badge tone="info">Resubmitted</Badge>}
                    <Badge tone={w.over ? "warning" : "neutral"}>
                      {w.label}
                      {w.over > 0 && `, ${w.over} over target`}
                    </Badge>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
