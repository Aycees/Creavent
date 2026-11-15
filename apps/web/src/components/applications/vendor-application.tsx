"use client"

import { formatPeso, vendorStatusLabels, type VendorApplication, type VendorApplicationRow, type VendorStatus } from "@creavent/shared"
import { CheckIcon, ClockIcon, CopyIcon, QrCodeIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { ApprovedMark } from "@/components/ui/approved-mark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateStamp } from "@/components/ui/date-stamp"
import { api } from "@/lib/api"
import { eventDays, formatDeadline, formatSchedule, stampDate, timeLeft } from "@/lib/event-format"
import { cn } from "@/lib/utils"

export const vendorApplicationKey = (id: string) => ["vendor-application", id] as const

function useVendorApplication(id: string) {
  return useQuery({
    queryKey: vendorApplicationKey(id),
    queryFn: async (): Promise<VendorApplication | null> => {
      const { data, response } = await api.GET("/api/vendor/applications/{id}", { params: { path: { id } } })
      if (response.status === 404) return null
      if (!data) throw new Error(`GET /api/vendor/applications/${id} failed with ${response.status}`)
      return data
    },
  })
}

const statusTone: Record<VendorStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  submitted: "info",
  approved: "info",
  slot_assigned: "warning",
  reserved: "success",
  declined: "neutral",
  withdrawn: "neutral",
  removed: "neutral",
}

const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" })
const day = (iso: string) => dayFormat.format(new Date(iso))

// /vendor/applications (spec §4.6).
export function VendorApplicationsList() {
  const { data, isError } = useQuery({
    queryKey: ["vendor-applications"],
    queryFn: async (): Promise<VendorApplicationRow[]> => {
      const { data, response } = await api.GET("/api/vendor/applications")
      if (!data) throw new Error(`GET /api/vendor/applications failed with ${response.status}`)
      return data.applications
    },
  })
  if (isError) return <Alert tone="danger">We couldn&apos;t load your applications. Refresh to try again.</Alert>
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1">Applications</h1>
      {data === undefined ? (
        <p role="status" className="text-sm text-muted">Loading…</p>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-body">No applications yet.</p>
          <Button asChild>
            <Link href="/vendor/events">Browse events</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((a) => (
            <li key={a.id}>
              <ApplicationRow application={a} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ApplicationRow({ application: a }: { application: VendorApplicationRow }) {
  const id = React.useId()
  return (
    <article aria-labelledby={id} className="relative flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
      {a.event.startDate && <DateStamp date={stampDate(a.event.startDate)} />}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 id={id} className="text-h3">
          <Link href={`/vendor/applications/${a.id}`} className="after:absolute after:inset-0 hover:underline">
            {a.event.name}
          </Link>
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge tone={statusTone[a.status]}>{vendorStatusLabels[a.status]}</Badge>
          {a.slotLabel && a.amountDue !== null && <span className="tabular-nums">{`${a.slotLabel} · ${formatPeso(a.amountDue)}`}</span>}
          {a.status === "slot_assigned" && a.deadlineAt && <span>{`Pay by ${formatDeadline(a.deadlineAt)}`}</span>}
        </div>
      </div>
    </article>
  )
}

// /vendor/applications/[id] (spec §4.6, §6.2, mockup VendorApplication).
export function VendorApplicationPage({ id, children }: { id: string; children?: (a: VendorApplication) => React.ReactNode }) {
  const { data, isError } = useVendorApplication(id)
  const [now] = React.useState(() => Date.now())
  if (isError) return <Alert tone="danger">We couldn&apos;t load this application. Refresh to try again.</Alert>
  if (data === undefined) return <p role="status" className="text-sm text-muted">Loading…</p>
  if (data === null) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-h1">Application not found</h1>
        <Button asChild variant="secondary">
          <Link href="/vendor/applications">See your applications</Link>
        </Button>
      </div>
    )
  }
  const a = data
  const slot = a.assignment && (a.assignment.status === "assigned" || a.assignment.status === "reserved") ? a.assignment : null
  const paying = slot?.status === "assigned"

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
        <Link href="/vendor/applications" className="hover:text-ink">Applications</Link>
        <span aria-hidden="true">/</span>
        <span className="truncate">{a.event.name}</span>
      </nav>

      <header className="flex flex-wrap items-center gap-4">
        {a.event.startDate && <DateStamp date={stampDate(a.event.startDate)} size="lg" endDay={eventDays(a.event) > 1 && a.event.endDate ? Number(a.event.endDate.slice(8)) : undefined} />}
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
          <h1 className="text-h1">{a.event.name}</h1>
          <p className="text-sm text-muted">{[formatSchedule(a.event), a.event.venueName, a.organizer.displayName].filter(Boolean).join(" · ")}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/events/${a.event.slug}`}>View event</Link>
        </Button>
      </header>

      {/* Phones: Pay by first, then the details, then the side panels.
          Desktop: Pay by tops the side column. */}
      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-x-8">
        {paying && slot && (
          <div className="flex items-center gap-3 rounded-lg bg-warning-soft px-4 py-3.5 text-warning-ink md:col-start-2 md:row-start-1 md:flex-col md:items-start md:gap-1 md:px-6 md:py-5">
            <ClockIcon aria-hidden="true" className="size-6 flex-none md:hidden" />
            <div className="flex flex-col gap-1">
              <p className="text-label font-semibold md:text-h2">{`Pay by ${formatDeadline(slot.deadlineAt)}`}</p>
              <p className="text-cap md:text-sm">{`${timeLeft(slot.deadlineAt, now)}. Late payments are flagged to the organizer, who may give the slot to someone else.`}</p>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-6 md:col-start-1 md:row-span-2 md:row-start-1">
          <StatusPanel application={a} />

          {slot && (
            <section aria-label="Your slot" className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4 md:gap-6 md:p-6">
              <div className="grid size-18 flex-none place-items-center rounded-md bg-inverse text-on-inverse md:size-28">
                <div className="text-center">
                  <p className="hidden text-cap text-on-inverse-muted md:block">Your slot</p>
                  <p className="font-mono text-xl font-semibold md:text-[30px] md:leading-9">{slot.slotLabel}</p>
                </div>
              </div>
              <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
                {slot.sizeLabel || slot.note ? <p className="text-h3">{[slot.sizeLabel, slot.note?.toLowerCase()].filter(Boolean).join(", ")}</p> : null}
                <p className="text-sm text-muted">The price and payment details were locked when this slot was assigned to you.</p>
              </div>
              <div className="md:text-right">
                <p className="text-sm text-muted">{slot.status === "reserved" ? "Paid" : "Amount due"}</p>
                <p className="text-price tabular-nums">{formatPeso(slot.amountDue)}</p>
              </div>
            </section>
          )}

          {paying && slot && <PaymentOptions slot={slot} organizer={a.organizer.displayName} />}
          {children?.(a)}
        </div>

        <aside className="flex flex-col gap-4 md:col-start-2">
          <Timeline application={a} />
          <section aria-labelledby="org-h" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 md:p-5">
            <h2 id="org-h" className="text-h3">Organizer</h2>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              {a.organizer.displayName}
              {a.organizer.approved && <ApprovedMark />}
            </p>
            <p className="text-sm">{[a.organizer.fullName, a.organizer.phone].filter(Boolean).join(" · ")}</p>
            {a.organizer.contactEmail && <p className="text-sm break-all">{a.organizer.contactEmail}</p>}
          </section>
          {a.event.ingressInfo && (
            <section aria-labelledby="ingress-h" className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 md:p-5">
              <h2 id="ingress-h" className="text-h3">Setting up</h2>
              <p className="text-sm whitespace-pre-line">{a.event.ingressInfo}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function StatusPanel({ application: a }: { application: VendorApplication }) {
  const message: Partial<Record<VendorStatus, string>> = {
    submitted: "Waiting for the organizer to review your application.",
    approved: "You're approved. The organizer assigns your slot next. No slot assigned yet.",
    reserved: `You're confirmed. Slot ${a.assignment?.slotLabel ?? ""} is yours.`,
    declined: "The organizer declined your application.",
    withdrawn: "You withdrew this application.",
    removed: "The organizer removed you from this event.",
  }
  const text = message[a.status]
  if (!text) return null
  const again = a.status === "declined" || a.status === "withdrawn"
  return (
    <section aria-label="Status" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5">
      <p className="flex items-center gap-2 text-label font-semibold">
        {a.status === "reserved" && <CheckIcon aria-hidden="true" className="size-5 text-success" weight="bold" />}
        {text}
      </p>
      {a.preferredSlot && (
        <p className="text-sm">
          {a.preferredSlot.state === "removed" ? `Preferred slot ${a.preferredSlot.label} is no longer available` : `Preferred slot: ${a.preferredSlot.label}`}
          {a.preferredSlot.state === "taken" && <span className="text-muted"> (now taken)</span>}
        </p>
      )}
      {(a.decisionNote || a.removalNote) && (
        <blockquote className="border-l-2 border-border-strong pl-3 text-sm whitespace-pre-line">{a.status === "removed" ? a.removalNote : a.decisionNote}</blockquote>
      )}
      {again && (
        <Button asChild variant="secondary" className="self-start">
          <Link href={`/vendor/events/${a.event.slug}/apply`}>Apply again</Link>
        </Button>
      )}
    </section>
  )
}

function PaymentOptions({ slot, organizer }: { slot: NonNullable<VendorApplication["assignment"]>; organizer: string }) {
  return (
    <section aria-labelledby="pay-h" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:gap-5 md:p-6">
      <div>
        <h2 id="pay-h" className="text-h2">1. Send your payment</h2>
        <p className="text-sm text-muted">{`Pay ${organizer} directly using ${slot.instructions.length > 1 ? "any option" : "this option"}.`}</p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {slot.instructions.map((i) => (
          <li key={i.id} className="flex flex-col gap-1 rounded-md bg-sunken p-4">
            <p className="text-label font-semibold">{i.label}</p>
            {i.accountName && <p className="text-sm">{i.accountName}</p>}
            {i.accountNumber && <p className="font-mono text-sm">{i.accountNumber}</p>}
            {i.notes && <p className="text-cap text-muted">{i.notes}</p>}
            <div className="mt-1 flex flex-wrap gap-2">
              {i.accountNumber && <CopyButton text={i.accountNumber} label={`Copy ${i.label} number`} />}
              {i.qrUrl && (
                <Button asChild variant="ghost" size="sm" className="h-11 md:h-9">
                  <a href={i.qrUrl} target="_blank" rel="noreferrer">
                    <QrCodeIcon aria-hidden="true" />
                    {`Show ${i.label} QR code`}
                  </a>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Alert tone="warning">
        Payments happen outside Creavent. Creavent doesn&apos;t hold or guarantee payments. Before you pay, check that the organizer is &quot;Approved by Creavent&quot; and look at their past events.
      </Alert>
    </section>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="h-11 md:h-9"
      aria-label={label}
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
      }}
    >
      {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  )
}

// Applied, approved, slot assigned, pay and upload proof, slot reserved (spec §4.6).
function Timeline({ application: a }: { application: VendorApplication }) {
  const slot = a.assignment
  const steps = [
    { label: "Applied", detail: `${day(a.submittedAt)}${a.documentCount ? ` · ${a.documentCount} document${a.documentCount > 1 ? "s" : ""}` : ""}`, done: true },
    { label: "Approved", detail: a.decidedAt && a.status !== "declined" ? day(a.decidedAt) : "After the organizer reviews it", done: Boolean(a.decidedAt) && !["declined", "submitted", "withdrawn"].includes(a.status) },
    { label: slot ? `Slot ${slot.slotLabel} assigned` : "Slot assigned", detail: slot ? day(slot.assignedAt) : "The organizer picks your slot", done: Boolean(slot) },
    { label: "Pay and upload proof", detail: "Send the payment, then upload a screenshot", done: slot?.status === "reserved" },
    { label: "Slot reserved", detail: slot?.reservedAt ? day(slot.reservedAt) : "After the organizer approves your payment", done: slot?.status === "reserved" },
  ]
  const current = steps.findIndex((s) => !s.done)
  return (
    <section aria-labelledby="progress-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5">
      <h2 id="progress-h" className="text-h3">Progress</h2>
      <ol aria-label="Progress" className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.label} aria-current={i === current ? "step" : undefined} className="flex gap-3">
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 grid size-6 flex-none place-items-center rounded-pill border-2",
                s.done ? "border-ink bg-ink text-on-inverse" : i === current ? "border-brand" : "border-border-strong"
              )}
            >
              {s.done && <CheckIcon className="size-3.5" weight="bold" />}
            </span>
            <div>
              <p className={cn("text-label", i === current && "font-semibold", !s.done && i !== current && "text-muted")}>{s.label}</p>
              <p className="text-cap text-muted">{i === current ? "You're here" : s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
