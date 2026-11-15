"use client"

import { vendorStatusLabels, type EventPage, type VendorEvent } from "@creavent/shared"
import { ArrowSquareOutIcon, FileTextIcon, ImageIcon, InfoIcon, MapPinIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { ApprovedMark } from "@/components/ui/approved-mark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateStamp } from "@/components/ui/date-stamp"
import { api } from "@/lib/api"
import { eventDays, formatDateTime, formatSchedule, stampDate } from "@/lib/event-format"

// The event page for one viewer (sitemap §3). Null when not found.
function useEventPage(slug: string) {
  return useQuery({
    queryKey: ["event-page", slug],
    queryFn: async (): Promise<EventPage | null> => {
      const { data, response } = await api.GET("/api/events/{slug}", { params: { path: { slug } } })
      if (response.status === 404) return null
      if (!data) throw new Error(`GET /api/events/${slug} failed with ${response.status}`)
      return data
    },
  })
}

// /events/[slug]. Phase 2 has the vendor view (mockup EventVendor); the
// public view comes with Phase 4.
export function EventPageView({ slug }: { slug: string }) {
  const { data, isError } = useEventPage(slug)
  if (isError) return <Alert tone="danger">We couldn&apos;t load this event. Refresh to try again.</Alert>
  if (data === undefined) return <p role="status" className="text-sm text-muted">Loading…</p>
  if (data === null) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-h1">Event not found</h1>
        <p className="text-body text-muted">This event doesn&apos;t exist, or it was removed.</p>
        <Button asChild variant="secondary">
          <Link href="/">See events</Link>
        </Button>
      </div>
    )
  }
  if (data.view === "not_public") {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-h1">This event isn&apos;t public yet</h1>
        <p className="text-body text-muted">The organizer is still finalizing vendors. Vendors can log in to see it and apply.</p>
        <Button asChild variant="secondary">
          <Link href="/login">Log in as a vendor</Link>
        </Button>
      </div>
    )
  }
  return <VendorView event={data.event} preview={data.preview} />
}

function VendorView({ event: e, preview }: { event: VendorEvent; preview: boolean }) {
  const days = eventDays(e)
  const accepted = e.categories.filter((c) => e.myCategoryIds.includes(c.id))

  return (
    <div className="flex flex-col gap-6">
      {preview ? (
        <Alert tone="warning">
          {`Preview: this is what vendors see.${e.status === "draft" ? " This event is a draft, so only you can see it." : ""}`}
        </Alert>
      ) : (
        e.status === "open_to_vendors" && (
          <Alert tone="info">Vendor view. This event is open to vendors. Visitors can&apos;t see it until the organizer announces it.</Alert>
        )
      )}

      {/* Phones: cover and header, then the fee and Apply, then the details,
          with the organizer's contact last. Desktop: details on the left and
          the summary and contact in a sticky column on the right. */}
      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-x-8">
        <div className="flex flex-col gap-6 md:col-start-1">
          {/* The cover exactly as the organizer framed it, 16:9 at every width. */}
          <div className="grid aspect-video w-full place-items-center overflow-hidden rounded-lg bg-sunken text-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
            {e.coverUrl ? <img src={e.coverUrl} alt="" className="size-full object-cover" /> : <ImageIcon aria-hidden="true" className="size-8" />}
          </div>
          <header className="flex gap-4">
            {e.startDate && <DateStamp date={stampDate(e.startDate)} endDay={days > 1 && e.endDate ? Number(e.endDate.slice(8)) : undefined} size="lg" />}
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Badge dot={false}>{e.typeName}</Badge>
                {days > 1 && <Badge dot={false}>{days} days</Badge>}
              </div>
              <h1 className="text-h1">{e.name}</h1>
              <p className="text-body">{formatSchedule(e) ?? "Dates to be announced"}</p>
              <p className="flex items-start gap-1.5 text-sm text-muted">
                <MapPinIcon aria-hidden="true" className="mt-0.5 size-4 flex-none" />
                {[e.venueName, e.addressLine, e.city].filter(Boolean).join(", ") || "Venue to be announced"}
              </p>
              <p className="flex flex-wrap items-center gap-2 text-sm">
                {e.organizer.slug ? (
                  <Link href={`/organizers/${e.organizer.slug}`} className="font-medium hover:underline">
                    {e.organizer.displayName}
                  </Link>
                ) : (
                  <span className="font-medium">{e.organizer.displayName}</span>
                )}
                {e.organizer.approved && <ApprovedMark />}
              </p>
            </div>
          </header>
        </div>

        <aside className="contents md:sticky md:top-6 md:col-start-2 md:row-span-2 md:row-start-1 md:flex md:flex-col md:gap-4">
          <section aria-label="Summary" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5">
            <div>
              <p className="text-cap text-muted">Slot fee</p>
              <p className="text-price tabular-nums">{e.summary.feeRange ?? "Not set"}</p>
            </div>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Applications close</dt>
                <dd className="text-right">{e.applicationsCloseAt ? formatDateTime(e.applicationsCloseAt) : "No date set"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Pay within</dt>
                <dd className="text-right">{e.summary.deadlineHours} hours of assignment</dd>
              </div>
              {days > 1 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Event runs</dt>
                  <dd className="text-right">{days} days</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Paid to</dt>
                <dd className="text-right">{e.summary.paidTo ? `Organizer. ${e.summary.paidTo}` : "Organizer"}</dd>
              </div>
            </dl>
            {e.myApplication && !preview && (
              <p className="rounded-md bg-sunken px-4 py-3 text-label">{`Your application: ${vendorStatusLabels[e.myApplication.status]}`}</p>
            )}
            {e.myApplication && !preview && !["declined", "withdrawn"].includes(e.myApplication.status) ? (
              <Button asChild variant="secondary" block>
                <Link href={`/vendor/applications/${e.myApplication.id}`}>View your application</Link>
              </Button>
            ) : e.acceptingApplications ? (
              <>
                <Button asChild variant="brand" block>
                  <Link href={`/vendor/events/${e.slug}/apply`}>{e.myApplication && !preview ? "Apply again" : "Apply as vendor"}</Link>
                </Button>
                <p className="text-cap text-muted">By applying you accept the event&apos;s policy.</p>
              </>
            ) : (
              <p className="rounded-md bg-sunken px-4 py-3 text-center text-label">Applications closed</p>
            )}
          </section>

          <section aria-label="Contact the organizer" className="order-last flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 md:p-5">
            <h2 className="text-h3">Contact the organizer</h2>
            <p className="text-cap text-muted">Shared with vendors only.</p>
            <p className="text-sm whitespace-pre-line">{e.vendorContactInfo ?? "No contact details yet."}</p>
          </section>
        </aside>

        <div className="flex flex-col gap-6 md:col-start-1">
          {e.description && <p className="text-body whitespace-pre-line">{e.description}</p>}

          <Section title="Requirements">
            {e.myCategoryIds.length > 0 &&
              (accepted.length > 0 ? (
                <Alert tone="success">
                  {accepted
                    .map((c) =>
                      c.max !== null
                        ? `Your category, ${c.name}, is accepted. ${c.left} of ${c.max} spots for this category are left.`
                        : `Your category, ${c.name}, is accepted.`
                    )
                    .join(" ")}
                </Alert>
              ) : (
                <Alert tone="warning">Your categories aren&apos;t accepted at this event. Check the list below before you apply.</Alert>
              ))}
            {e.categories.length === 0 ? (
              <p className="text-sm text-muted">The organizer hasn&apos;t listed the accepted categories yet.</p>
            ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-sunken text-left text-cap text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Accepted category</th>
                    <th className="px-4 py-3 font-medium">Limit</th>
                    <th className="px-4 py-3 text-right font-medium">Left</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {e.categories.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3">{c.name}</td>
                      <td className="px-4 py-3 text-muted">{c.max === null ? "No limit" : `Up to ${c.max} vendors`}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.left ?? <span className="text-muted">No limit</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            {e.documents.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-label font-semibold">Documents to upload when you apply</h3>
                <ul className="flex flex-col gap-2">
                  {e.documents.map((d) => (
                    <li key={d.name} className="flex items-center gap-2 text-sm">
                      <FileTextIcon aria-hidden="true" className="size-5 flex-none text-muted" />
                      {d.categoryName ? `${d.name} · ${d.categoryName} only` : d.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section title="Slots and prices" intro={days > 1 ? `Each slot is yours for all ${days} days, paid once.` : undefined}>
            <p className="flex items-start gap-2 text-sm text-muted">
              <InfoIcon aria-hidden="true" className="mt-0.5 size-4 flex-none" />
              {e.preferredSlots
                ? "You can choose a preferred slot when you apply. The organizer assigns your slot after approving you."
                : "The organizer assigns your slot after approving you."}
            </p>
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
              {e.slotGroups.map((g) => (
                <li key={g.name} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-label font-semibold">{g.name}</span>
                    <span className="text-cap text-muted">{[g.range, g.sizes, g.notes].filter(Boolean).join(" · ")}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm tabular-nums">{g.feeRange ?? "Price to follow"}</span>
                    <span className="text-cap text-muted tabular-nums">
                      <span className="sr-only">Open: </span>
                      {`${g.open} of ${g.total}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {e.vendorFloorPlanUrl && (
              <a href={e.vendorFloorPlanUrl} target="_blank" rel="noreferrer" className="relative block overflow-hidden rounded-md border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
                <img src={e.vendorFloorPlanUrl} alt="Vendor floor plan, numbered empty slots" className="w-full object-contain" />
                <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-sm bg-surface/90 px-2 py-1 text-cap">
                  <ArrowSquareOutIcon aria-hidden="true" className="size-4" />
                  Open full size
                </span>
              </a>
            )}
          </Section>

          <Section title="Cancellation and withdrawal policy">
            <p className="text-body whitespace-pre-line">{e.policy ?? "The organizer hasn't written a policy yet."}</p>
            <p className="text-cap text-muted">Written by {e.organizer.displayName}. Creavent doesn&apos;t handle payments or refunds.</p>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  const id = React.useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-h2">
          {title}
        </h2>
        {intro && <p className="text-sm text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  )
}
