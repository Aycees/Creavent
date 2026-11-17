"use client"

import { REPORT_REASON_LABELS, type ReportGroup } from "@creavent/shared"
import { PlusIcon } from "@phosphor-icons/react"
import Link from "next/link"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Badge, Tag } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Segmented, SegmentedItem } from "@/components/ui/segmented"
import { AddReportDialog } from "./add-report-dialog"
import { useReportGroups } from "./queries"

const day = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" })

export const outcomeLabels: Record<string, string> = {
  none: "Dismissed",
  event_hidden: "Event hidden",
  user_suspended: "Role suspended",
  other: "Resolved",
}

function GroupRow({ g }: { g: ReportGroup }) {
  const resolved = g.status !== "open"
  return (
    <Link href={`/admin/reports/${g.id}`} className="flex min-h-16 flex-col gap-2 px-4 py-3 no-underline hover:bg-sunken md:flex-row md:items-center md:gap-4">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <Badge dot={false}>{g.target.type === "event" ? "Event" : "User"}</Badge>
          <span className="text-label font-semibold text-ink">{g.target.name}</span>
        </span>
        <span className="text-cap text-muted">
          {g.target.subtitle} · {g.reasons.map((r) => REPORT_REASON_LABELS[r]).join(", ")}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {g.fromEmail && <Tag>Email</Tag>}
        <Badge tone={!resolved && g.count > 1 ? "warning" : "neutral"}>{g.count === 1 ? "1 report" : `${g.count} reports`}</Badge>
        {resolved ? (
          <Badge tone={g.actionTaken === "none" ? "neutral" : "danger"}>{outcomeLabels[g.actionTaken ?? "other"]}</Badge>
        ) : null}
        <span className="text-cap text-muted">
          {resolved && g.resolvedAt ? `Resolved ${day.format(new Date(g.resolvedAt))}` : `Since ${day.format(new Date(g.oldestAt))}`}
        </span>
      </span>
    </Link>
  )
}

// /admin/reports: Open and Resolved (sitemap §6, mockup AdminReportsP5).
export function ReportsQueue() {
  const [status, setStatus] = React.useState<"open" | "resolved">("open")
  const [adding, setAdding] = React.useState(false)
  const { data, isError } = useReportGroups(status)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1">Reports</h1>
          <p className="text-body text-muted">From the report button and the support inbox. Reports about the same event or user are grouped, oldest first.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
          <PlusIcon aria-hidden="true" />
          Add report from email
        </Button>
      </div>
      <Segmented role="group" aria-label="Report status" className="self-start">
        <SegmentedItem type="button" active={status === "open"} onClick={() => setStatus("open")}>
          Open{data ? ` (${data.openCount})` : ""}
        </SegmentedItem>
        <SegmentedItem type="button" active={status === "resolved"} onClick={() => setStatus("resolved")}>
          Resolved{data ? ` (${data.resolvedCount})` : ""}
        </SegmentedItem>
      </Segmented>
      {isError && <Alert tone="danger">We couldn&apos;t load the reports. Refresh to try again.</Alert>}
      {data?.items.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-6 text-sm text-muted">{status === "open" ? "No open reports." : "No resolved reports yet."}</p>
      )}
      {data && data.items.length > 0 && (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {data.items.map((g) => (
            <li key={g.id}>
              <GroupRow g={g} />
            </li>
          ))}
        </ul>
      )}
      <AddReportDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}
