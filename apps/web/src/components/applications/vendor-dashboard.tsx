"use client"

import { formatPeso, vendorStatusLabels, type VendorDashboard } from "@creavent/shared"
import { CheckCircleIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateStamp } from "@/components/ui/date-stamp"
import { api } from "@/lib/api"
import { formatDateTime, formatDay, formatDeadline, formatSchedule, stampDate } from "@/lib/event-format"

// /vendor (spec §4.6, mockup VendorDashboard).
export function VendorDashboardPage() {
  const { data, isError } = useQuery({
    queryKey: ["vendor-dashboard"],
    queryFn: async (): Promise<VendorDashboard> => {
      const { data, response } = await api.GET("/api/vendor/dashboard")
      if (!data) throw new Error(`GET /api/vendor/dashboard failed with ${response.status}`)
      return data
    },
  })
  if (isError) return <Alert tone="danger">We couldn&apos;t load your dashboard. Refresh to try again.</Alert>
  if (!data) return <p role="status" className="text-sm text-muted">Loading…</p>
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">Your events</h1>
        <Button asChild variant="secondary">
          <Link href="/vendor/events">Find events to join</Link>
        </Button>
      </div>

      <section aria-labelledby="action-h" className="flex flex-col gap-3">
        <h2 id="action-h" className="text-h2">Needs your action</h2>
        {data.needsAction.length === 0 ? (
          <p className="text-sm text-muted">Nothing needs your action.</p>
        ) : (
          data.needsAction.map((n) => (
            <div key={n.applicationId} className="flex flex-wrap items-center gap-4 rounded-lg border border-warning bg-warning-soft p-4 md:p-5">
              {n.startDate && <DateStamp date={stampDate(n.startDate)} />}
              <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
                <p className="text-cap font-semibold text-warning-ink">{n.rejected ? "Proof rejected: upload a new one" : `Payment due ${formatDeadline(n.deadlineAt)}`}</p>
                <p className="text-label font-semibold">{`Pay ${formatPeso(n.amountDue)} for slot ${n.slotLabel} at ${n.eventName}`}</p>
                <p className="text-sm">{`Send it to ${n.organizerName}${n.paidTo ? ` by ${n.paidTo}` : ""}, then upload your receipt.`}</p>
              </div>
              <Button asChild className="max-md:w-full">
                <Link href={`/vendor/applications/${n.applicationId}`}>Upload proof of payment</Link>
              </Button>
            </div>
          ))
        )}
      </section>

      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-8">
        <section aria-labelledby="apps-h" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="apps-h" className="text-h2">Applications</h2>
            <Link href="/vendor/applications" className="inline-flex min-h-11 items-center text-sm underline">See all</Link>
          </div>
          {data.applications.length === 0 ? (
            <p className="text-sm text-muted">No applications yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
              {data.applications.map((a) => (
                <li key={a.id} className="relative flex items-center gap-3 px-4 py-3">
                  {a.event.startDate && <DateStamp date={stampDate(a.event.startDate)} />}
                  <div className="min-w-0 flex-1">
                    <Link href={`/vendor/applications/${a.id}`} className="text-label font-semibold after:absolute after:inset-0 hover:underline">
                      {a.event.name}
                    </Link>
                    <p className="text-cap text-muted">
                      {a.slotLabel ? `Slot ${a.slotLabel}${a.amountDue !== null ? ` · ${formatPeso(a.amountDue)}` : ""}` : a.status === "declined" && a.decisionNote ? `"${a.decisionNote}"` : "No slot yet"}
                    </p>
                  </div>
                  <Badge tone={a.status === "reserved" ? "success" : a.status === "slot_assigned" ? "warning" : "neutral"}>{vendorStatusLabels[a.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-4">
          {data.nextEvent && (
            <section aria-labelledby="next-h" className="flex flex-col gap-3 rounded-lg bg-inverse p-5 text-on-inverse">
              <h2 id="next-h" className="flex items-center gap-2 text-h3">
                <CheckCircleIcon aria-hidden="true" className="size-5" />
                You&apos;re confirmed
              </h2>
              <p className="text-h3">{data.nextEvent.event.name}</p>
              <p className="text-sm text-on-inverse-muted">{[formatSchedule(data.nextEvent.event), `Slot ${data.nextEvent.slotLabel}`].filter(Boolean).join(" · ")}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-on-inverse-muted">Organizer</dt>
                <dd>{[data.nextEvent.organizerName, data.nextEvent.organizerPhone].filter(Boolean).join(" · ")}</dd>
                {data.nextEvent.ingressInfo && (
                  <>
                    <dt className="text-on-inverse-muted">Ingress</dt>
                    <dd>{data.nextEvent.ingressInfo}</dd>
                  </>
                )}
              </dl>
              <div className="flex flex-wrap gap-2">
                {data.nextEvent.vendorFloorPlanUrl && (
                  <Button asChild variant="secondary" size="sm" className="h-11 md:h-9">
                    <a href={data.nextEvent.vendorFloorPlanUrl} target="_blank" rel="noreferrer">View floor plan</a>
                  </Button>
                )}
                <Button asChild variant="ghost" size="sm" className="h-11 text-on-inverse hover:bg-on-inverse/10 md:h-9">
                  <Link href={`/vendor/applications/${data.nextEvent.applicationId}`}>Details</Link>
                </Button>
              </div>
            </section>
          )}

          <section aria-labelledby="open-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5">
            <h2 id="open-h" className="text-h3">Open to vendors</h2>
            {data.openEvents.length === 0 ? (
              <p className="text-sm text-muted">No events in your categories are taking applications right now.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.openEvents.map((e) => (
                  <li key={e.slug} className="flex items-center gap-3">
                    {e.startDate && <DateStamp date={stampDate(e.startDate)} />}
                    <div className="min-w-0">
                      <Link href={`/events/${e.slug}`} className="text-label font-semibold hover:underline">{e.name}</Link>
                      <p className="text-cap text-muted">
                        {[e.startDate && e.endDate && e.startDate !== e.endDate ? `${formatDay(e.startDate)} to ${formatDay(e.endDate)}` : null, e.applied ? "applied" : null, e.applicationsCloseAt ? `closes ${formatDateTime(e.applicationsCloseAt).replace(/, \d.*$/, "")}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
