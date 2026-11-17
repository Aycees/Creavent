"use client"

import { formatTime } from "@creavent/shared"
import Link from "next/link"

import { EventStatusBadge } from "@/components/events/parts"
import { DateStamp } from "@/components/ui/date-stamp"
import { formatDay, stampDate } from "@/lib/event-format"
import { usePopupSummary } from "./queries"

const hostLines = {
  not_submitted: "Host approval: not submitted. Get approved to announce.",
  pending_review: "Host approval: pending review",
  rejected: "Host approval: not approved. See what to add.",
} as const

// "Your pop-ups" on the vendor dashboard (mockup P6VendorDashboardPhone).
export function YourPopups() {
  const { data } = usePopupSummary()
  if (!data) return null
  const status = data.host.status
  return (
    <section aria-labelledby="popups-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="popups-h" className="text-h3">
          Your pop-ups
        </h2>
        {data.total > 0 && (
          <Link href="/vendor/popups" className="text-sm">
            See all
          </Link>
        )}
      </div>
      {data.total === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted">Post where and when people can find your stall. It shows on the events page with your shop name.</p>
          <Link href="/vendor/popups/new" className="text-label font-semibold">
            Host a pop-up
          </Link>
        </div>
      ) : data.upcoming.length === 0 ? (
        <p className="text-sm text-muted">No upcoming pop-ups.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.upcoming.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              {p.startDate ? (
                <DateStamp date={stampDate(p.startDate)} />
              ) : (
                <span className="grid h-15 w-14 flex-none place-items-center rounded-md border border-dashed border-border-strong text-center text-cap text-muted">No date</span>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Link href={`/vendor/popups/${p.id}`} className="truncate text-label font-semibold hover:underline">
                  {p.name}
                </Link>
                <p className="text-cap text-muted">
                  {p.status === "draft"
                    ? `Next: ${p.nextStep}`
                    : [p.startDate && formatDay(p.startDate), p.opensAt && p.closesAt && `${formatTime(p.opensAt)} to ${formatTime(p.closesAt)}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <EventStatusBadge status={p.status} />
            </li>
          ))}
        </ul>
      )}
      {status !== "approved" && (
        <Link href="/vendor/host-approval" className="text-sm">
          {data.host.revoked ? "Host approval: revoked. See why." : hostLines[status]}
        </Link>
      )}
    </section>
  )
}
