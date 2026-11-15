"use client"

import { formatPeso, slotWords, vendorStatusLabels, type VendorApplication, type VendorApplicationRow, type VendorStatus } from "@creavent/shared"
import { ArrowsLeftRightIcon, CheckIcon, ClockIcon, CopyIcon, MinusSquareIcon, QrCodeIcon, XCircleIcon } from "@phosphor-icons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ApprovedMark } from "@/components/ui/approved-mark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { DateStamp } from "@/components/ui/date-stamp"
import { DropZone } from "@/components/ui/drop-zone"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { eventDays, formatDeadline, formatSchedule, stampDate, timeLeft } from "@/lib/event-format"
import { useUpload } from "@/lib/use-upload"
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

const ACTIVE_STATUSES: VendorStatus[] = ["submitted", "approved", "slot_assigned", "reserved"]

// What to do next for each status (mockup VendorApplicationsList).
function nextStep(a: VendorApplicationRow) {
  if (a.status === "slot_assigned") return a.paymentStatus === "submitted" ? "Proof sent, waiting for review" : "Upload proof of payment"
  return { submitted: "Waiting for review", approved: "Waiting for a slot", reserved: "You're confirmed", declined: "Apply again if you like", withdrawn: "Apply again if you like", removed: "See the organizer's note" }[a.status]
}

// /vendor/applications (spec §4.6, mockup VendorApplicationsList).
export function VendorApplicationsList() {
  const [show, setShow] = React.useState<"active" | "past">("active")
  const { data, isError } = useQuery({
    queryKey: ["vendor-applications"],
    queryFn: async (): Promise<VendorApplicationRow[]> => {
      const { data, response } = await api.GET("/api/vendor/applications")
      if (!data) throw new Error(`GET /api/vendor/applications failed with ${response.status}`)
      return data.applications
    },
  })
  if (isError) return <Alert tone="danger">We couldn&apos;t load your applications. Refresh to try again.</Alert>
  const active = data?.filter((a) => ACTIVE_STATUSES.includes(a.status)) ?? []
  const past = data?.filter((a) => !ACTIVE_STATUSES.includes(a.status)) ?? []
  const shown = show === "active" ? active : past
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1">Applications</h1>
          <p className="text-body text-muted">Every event you applied to, with what to do next.</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/vendor/events">Find events to join</Link>
        </Button>
      </div>
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
        <>
          <div className="flex gap-2">
            <Chip pressed={show === "active"} count={active.length} onClick={() => setShow("active")}>Active</Chip>
            <Chip pressed={show === "past"} count={past.length} onClick={() => setShow("past")}>Past and closed</Chip>
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-muted">{show === "active" ? "Nothing active right now." : "Nothing here yet."}</p>
          ) : (
            <ul className="flex flex-col gap-3 md:gap-0 md:divide-y md:divide-border md:overflow-hidden md:rounded-lg md:border md:border-border md:bg-surface">
              {shown.map((a) => (
                <li key={a.id}>
                  <ApplicationRow application={a} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function ApplicationRow({ application: a }: { application: VendorApplicationRow }) {
  const id = React.useId()
  const due = a.status === "slot_assigned" && a.deadlineAt && a.paymentStatus !== "submitted"
  return (
    <article aria-labelledby={id} className={cn("relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-surface p-4 md:rounded-none md:border-0 md:px-5", due ? "border-warning" : "border-border")}>
      {a.event.startDate && <DateStamp date={stampDate(a.event.startDate)} />}
      <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
        <h2 id={id} className="text-label font-semibold md:text-base">
          <Link href={`/vendor/applications/${a.id}`} className="after:absolute after:inset-0 hover:underline">
            {a.event.name}
          </Link>
        </h2>
        <p className="text-cap text-muted">{a.slotLabel && a.amountDue !== null ? `${slotWords(a.slotLabel, true)} · ${formatPeso(a.amountDue)}` : a.decisionNote && a.status === "declined" ? `"${a.decisionNote}"` : "No slot yet"}</p>
      </div>
      <Badge tone={due ? "warning" : statusTone[a.status]}>{due ? `Pay by ${formatDeadline(a.deadlineAt!)}` : vendorStatusLabels[a.status]}</Badge>
      <p className="w-full text-sm md:w-48 md:text-right">{nextStep(a)}</p>
    </article>
  )
}

// /vendor/applications/[id] (spec §4.6, §6.2, mockup VendorApplication).
export function VendorApplicationPage({ id }: { id: string }) {
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
              <p className="text-cap md:text-sm">{`${timeLeft(slot.deadlineAt, now)}. Late payments are flagged to the organizer, who may give the ${slot.slots.length > 1 ? "slots" : "slot"} to someone else.`}</p>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-6 md:col-start-1 md:row-span-2 md:row-start-1">
          <StatusPanel application={a} />

          {slot && (
            <section aria-label={slot.slots.length > 1 ? "Your slots" : "Your slot"} className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4 md:gap-6 md:p-6">
              <div className="grid size-18 flex-none place-items-center rounded-md bg-inverse text-on-inverse md:size-28">
                <div className="text-center">
                  <p className="hidden text-cap text-on-inverse-muted md:block">{slot.slots.length > 1 ? "Your slots" : "Your slot"}</p>
                  {slot.slots.length > 1 ? (
                    <p className="font-mono text-[15px] leading-5 font-semibold md:text-xl md:leading-7">
                      {slot.slots.map((x) => (
                        <span key={x.label} className="block">{x.label}</span>
                      ))}
                      <span className="sr-only">{slot.slotLabel}</span>
                    </p>
                  ) : (
                    <p className="font-mono text-xl font-semibold md:text-[30px] md:leading-9">{slot.slotLabel}</p>
                  )}
                </div>
              </div>
              <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
                {slotDetail(slot.slots) ? <p className="text-h3">{slotDetail(slot.slots)}</p> : null}
                <p className="text-sm text-muted">{`The price and payment details were locked when ${slot.slots.length > 1 ? "these slots were" : "this slot was"} assigned to you.`}</p>
              </div>
              <div className="md:text-right">
                <p className="text-sm text-muted">{slot.status === "reserved" ? "Paid" : "Amount due"}</p>
                <p className="text-price tabular-nums">{formatPeso(slot.amountDue)}</p>
              </div>
            </section>
          )}

          {paying && slot && <PaymentOptions slot={slot} organizer={a.organizer.displayName} />}
          {!slot && (a.status === "submitted" || a.status === "approved") && (a.event.preferredSlots || a.preferredSlots.length > 0) && (
            <PreferredSlotCard application={a} />
          )}
          {paying && slot && <ProofSection applicationId={a.id} slot={slot} />}
          {paying && slot && <ChangeOfPlans application={a} slotLabel={slot.slotLabel} />}
          {(() => {
            // Read-only proofs: an ended slot's, and those of earlier slots.
            const records = [...(a.assignment && !slot ? a.assignment.proofs : []), ...a.pastProofs]
            return records.length > 0 ? <PaymentRecords proofs={records} /> : null
          })()}
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
          {!slot && (a.status === "submitted" || a.status === "approved") && <WithdrawControl application={a} />}
          {slot?.status === "reserved" && (
            <p className="rounded-md bg-sunken p-4 text-sm text-muted">Can&apos;t make it? Contact the organizer. They decide under their policy.</p>
          )}
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
    reserved: `You're confirmed. ${slotWords(a.assignment?.slotLabel ?? "", true)} ${a.assignment?.slotLabel.includes(", ") ? "are" : "is"} yours.`,
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
      {(a.decisionNote || a.removalNote) && (
        <blockquote className="border-l-2 border-border-strong pl-3 text-sm whitespace-pre-line">{a.status === "removed" ? a.removalNote : a.decisionNote}</blockquote>
      )}
      {a.status === "removed" && (
        <p className="text-sm">{a.canReapply ? "The organizer lets you apply to this event again." : "You can't reapply to this event."}</p>
      )}
      {(again || (a.status === "removed" && a.canReapply)) && (
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
  // Only an active slot counts: after a release or removal the vendor is back
  // to waiting for one (or out of the event).
  const slot = a.assignment && (a.assignment.status === "assigned" || a.assignment.status === "reserved") ? a.assignment : null
  const steps = [
    { label: "Applied", detail: `${day(a.submittedAt)}${a.documentCount ? ` · ${a.documentCount} document${a.documentCount > 1 ? "s" : ""}` : ""}`, done: true },
    { label: "Approved", detail: a.decidedAt && a.status !== "declined" ? day(a.decidedAt) : "After the organizer reviews it", done: Boolean(a.decidedAt) && !["declined", "submitted", "withdrawn"].includes(a.status) },
    { label: slot ? `${slotWords(slot.slotLabel, true)} assigned` : "Slot assigned", detail: slot ? day(slot.assignedAt) : "The organizer picks your slot", done: Boolean(slot) },
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

type Slot = NonNullable<VendorApplication["assignment"]>
type ErrorBody = { message?: string; details?: { path: string; message: string }[] } | undefined

// "2. Upload your proof of payment" (spec §6.2, mockup VendorApplication).
function ProofSection({ applicationId, slot }: { applicationId: string; slot: Slot }) {
  const queryClient = useQueryClient()
  const { upload, pending, error: uploadError } = useUpload("payment_proof")
  const [file, setFile] = React.useState<{ id: string; name: string } | null>(null)
  const [methodId, setMethodId] = React.useState(slot.instructions.length === 1 ? slot.instructions[0].id : "")
  const [amount, setAmount] = React.useState(String(slot.amountDue))
  const [reference, setReference] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)
  const latest = slot.proofs[0]

  if (slot.paymentStatus === "submitted") {
    return (
      <section aria-label="2. Upload your proof of payment" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 md:p-6">
        <h2 className="text-h2">2. Upload your proof of payment</h2>
        <p className="text-body">Your proof is with the organizer. We&apos;ll email you when they review it.</p>
        {latest && (
          <a href={latest.fileUrl} target="_blank" rel="noreferrer" className="self-start text-sm underline">
            See the screenshot you sent
          </a>
        )}
      </section>
    )
  }

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    event.target.value = ""
    if (!picked) return
    const done = await upload(picked)
    if (done) setFile({ id: done.id, name: picked.name })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!file) return setError("Add a screenshot of your payment")
    if (!methodId) return setError("Pick the option you paid with")
    const amountClaimed = Number(amount.replace(/[₱,\s]/g, ""))
    if (!Number.isFinite(amountClaimed) || amountClaimed < 0) return setError("Enter the amount you sent")
    setSending(true)
    const res = await api.POST("/api/vendor/applications/{id}/proofs", {
      params: { path: { id: applicationId } },
      body: { fileId: file.id, paymentMethodId: methodId, amountClaimed, ...(reference.trim() ? { referenceNumber: reference.trim() } : {}) },
    })
    setSending(false)
    if (!res.data) {
      const body = res.error as ErrorBody
      return setError(body?.details?.[0]?.message ?? body?.message ?? "Something went wrong. Try again.")
    }
    queryClient.setQueryData(vendorApplicationKey(applicationId), res.data)
    // Other screens (lists, dashboards) show the change without a reload.
    void queryClient.invalidateQueries()
  }

  return (
    <section aria-labelledby="proof-h" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:gap-5 md:p-6">
      <div>
        <h2 id="proof-h" className="text-h2">2. Upload your proof of payment</h2>
        <p className="text-sm text-muted">A screenshot of the GCash receipt or bank confirmation. The organizer checks it and confirms your slot.</p>
      </div>
      {latest?.status === "rejected" && (
        <Alert tone="danger">{`The organizer couldn't approve your last proof: ${latest.rejectionReason ?? "no reason given"}`}</Alert>
      )}
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <DropZone
          id="proof-file"
          accept="image/jpeg,image/png,image/webp"
          onChange={pick}
          disabled={pending}
          prompt={pending ? "Uploading…" : file ? `${file.name} · choose a file to replace it` : "Take a photo or choose a file"}
          hint="JPEG, PNG or WebP, up to 10 MB"
        />
        {uploadError && <p className="text-help text-danger-ink">{uploadError}</p>}
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-label">Paid with</legend>
          <div className="grid gap-3 md:grid-cols-2">
            {slot.instructions.map((i) => (
              <label key={i.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border-strong bg-surface p-4 has-checked:border-2 has-checked:border-ink has-checked:p-[15px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
                <input type="radio" name="paid-with" value={i.id} checked={methodId === i.id} onChange={() => setMethodId(i.id)} className="size-5 flex-none accent-ink" />
                <span className="flex flex-col">
                  <span className="text-label font-semibold">{i.label}</span>
                  <span className="text-cap text-muted">{[i.accountName, i.accountNumber].filter(Boolean).join(" · ")}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="proof-amount" className="text-label">Amount sent</label>
            <Input id="proof-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="proof-ref" className="text-label">
              Reference number <span className="font-normal text-muted">(optional)</span>
            </label>
            <Input id="proof-ref" value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} placeholder="For example, 7012 345 678901" />
          </div>
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={sending || pending} className="max-md:w-full">
            Submit proof
          </Button>
          <span className="text-sm text-muted">You&apos;ll get an email when it&apos;s approved.</span>
        </div>
      </form>
    </section>
  )
}

// The preferred slots while no slot is assigned: change or clear them
// (decided 2026-11-15). A preference holds nothing (spec §4.3).
function PreferredSlotCard({ application: a }: { application: VendorApplication }) {
  const save = useSaved(a.id)
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)
  const prefs = a.preferredSlots
  const many = a.slotsRequested > 1
  const stateText = { open: "Open", taken: "Taken", removed: "No longer available" } as const

  async function clear() {
    setSending(true)
    setError(null)
    const res = await api.PUT("/api/vendor/applications/{id}/preference", { params: { path: { id: a.id } }, body: { preferredSlotIds: [] } })
    setSending(false)
    if (!res.data) return setError((res.error as ErrorBody)?.message ?? "Something went wrong. Try again.")
    save(res.data)
  }

  return (
    <section aria-labelledby="pref-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="pref-h" className="text-h3">{many ? "Preferred slots" : "Preferred slot"}</h2>
        {!many && prefs[0] && <Badge tone={prefs[0].state === "open" ? "success" : "warning"}>{stateText[prefs[0].state]}</Badge>}
      </div>
      {many && <p className="text-sm text-muted">{`You asked for ${a.slotsRequested} slots.`}</p>}
      {prefs.length === 0 ? (
        <p className="text-sm">{many ? "No preference. The organizer picks your slots." : "No preference. The organizer picks a slot for you."}</p>
      ) : many ? (
        <ul className="flex flex-col gap-1 text-sm">
          {prefs.map((p) => (
            <li key={p.id}>
              <span className="font-mono">{p.label}</span>
              {` · ${stateText[p.state]}`}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm">
          <span className="font-mono">{prefs[0].label}</span>
        </p>
      )}
      {prefs.length > 0 && <p className="text-cap text-muted">{many ? "Your picks aren't reserved until the organizer assigns them." : "Your pick isn't reserved until the organizer assigns it."}</p>}
      {a.event.preferredSlots && (
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm" className="h-11 flex-1 md:h-9 md:flex-none">
            <Link href={`/vendor/applications/${a.id}/slot`}>{prefs.length ? (many ? "Change slots" : "Change slot") : many ? "Pick slots" : "Pick a slot"}</Link>
          </Button>
          {prefs.length > 0 && (
            <Button variant="ghost" size="sm" className="h-11 flex-1 md:h-9 md:flex-none" disabled={sending} onClick={clear}>
              No preference
            </Button>
          )}
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </section>
  )
}

// "3 × 3 m, near the entrance" for one slot, "2 slots · 2 × 2 m each" for
// several of one size.
function slotDetail(slots: NonNullable<VendorApplication["assignment"]>["slots"]) {
  if (slots.length === 1) return [slots[0].sizeLabel, slots[0].note?.toLowerCase()].filter(Boolean).join(", ")
  const sizes = [...new Set(slots.map((x) => x.sizeLabel).filter(Boolean))]
  return sizes.length === 1 ? `${slots.length} slots · ${sizes[0]} each` : `${slots.length} slots`
}

// Withdraw while applied or approved (decided 2026-11-15).
function WithdrawControl({ application: a }: { application: VendorApplication }) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-sunken p-4">
      <p className="text-sm text-muted">Can&apos;t join anymore? Withdraw your application. The organizer is emailed, and you can apply again while the event takes applications.</p>
      <ConfirmAction
        application={a}
        kind="withdraw"
        trigger={(open) => (
          <Button variant="danger-ghost" size="sm" className="-ml-3.5 h-11 self-start md:h-9" onClick={open}>
            Withdraw application
          </Button>
        )}
      />
    </div>
  )
}

// With an unpaid slot: pick another, release, or withdraw (decided 2026-11-15).
function ChangeOfPlans({ application: a, slotLabel }: { application: VendorApplication; slotLabel: string }) {
  const many = slotLabel.includes(", ")
  const plan = "flex min-h-11 w-full items-start gap-3.5 rounded-md border border-border bg-surface p-4 text-left hover:border-border-strong"
  return (
    <section aria-labelledby="plans-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-6">
      <div>
        <h2 id="plans-h" className="text-h2">Change of plans?</h2>
        <p className="text-sm text-muted">You can change this until your payment is approved. The organizer is emailed either way.</p>
      </div>
      {a.event.preferredSlots && (
        <Link href={`/vendor/applications/${a.id}/slot`} className={plan}>
          <ArrowsLeftRightIcon aria-hidden="true" className="size-6 flex-none" />
          <span>
            <span className="block text-label font-semibold">{many ? "Pick other slots" : "Pick another slot"}</span>
            <span className="block text-sm text-muted">
              {many
                ? `Choose different open slots. ${slotLabel} open again together, and the organizer assigns your new picks.`
                : `Choose a different open slot. ${slotLabel} opens again, and the organizer assigns your new pick.`}
            </span>
          </span>
        </Link>
      )}
      <ConfirmAction
        application={a}
        kind="release"
        slotLabel={slotLabel}
        trigger={(open) => (
          <button type="button" className={plan} onClick={open}>
            <MinusSquareIcon aria-hidden="true" className="size-6 flex-none" />
            <span>
              <span className="block text-label font-semibold">{`Release ${slotWords(slotLabel)}`}</span>
              <span className="block text-sm text-muted">
                {many ? "Give up these slots together but stay approved. The organizer can assign you others." : "Give up this slot but stay approved. The organizer can assign you another one."}
              </span>
            </span>
          </button>
        )}
      />
      <ConfirmAction
        application={a}
        kind="withdraw"
        slotLabel={slotLabel}
        trigger={(open) => (
          <button type="button" className={cn(plan, "border-danger-soft")} onClick={open}>
            <XCircleIcon aria-hidden="true" className="size-6 flex-none text-danger-ink" />
            <span>
              <span className="block text-label font-semibold text-danger-ink">Withdraw from this event</span>
              <span className="block text-sm text-muted">{`Release ${many ? "your slots" : "the slot"} and end your application. You can apply again while the event takes applications.`}</span>
            </span>
          </button>
        )}
      />
    </section>
  )
}

function useSaved(applicationId: string) {
  const queryClient = useQueryClient()
  return (data: VendorApplication) => {
    queryClient.setQueryData(vendorApplicationKey(applicationId), data)
    // Other screens (lists, dashboards) show the change without a reload.
    void queryClient.invalidateQueries()
  }
}

// A confirm step for releasing or withdrawing.
function ConfirmAction({
  application: a,
  kind,
  slotLabel,
  trigger,
}: {
  application: VendorApplication
  kind: "release" | "withdraw"
  slotLabel?: string
  trigger: (open: () => void) => React.ReactNode
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)
  const release = kind === "release"
  const many = slotLabel?.includes(", ") ?? false

  async function confirm() {
    setSending(true)
    setError(null)
    const res = release
      ? await api.POST("/api/vendor/applications/{id}/release", { params: { path: { id: a.id } } })
      : await api.POST("/api/vendor/applications/{id}/withdraw", { params: { path: { id: a.id } } })
    setSending(false)
    if (!res.data) return setError((res.error as ErrorBody)?.message ?? "Something went wrong. Try again.")
    if (release) queryClient.setQueryData(vendorApplicationKey(a.id), res.data)
    void queryClient.invalidateQueries()
    setOpen(false)
  }

  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-label={release ? `Release ${slotWords(slotLabel ?? "")}?` : `Withdraw from ${a.event.name}?`}>
          <DialogHeader>
            <DialogTitle>{release ? `Release ${slotWords(slotLabel ?? "")}?` : `Withdraw from ${a.event.name}?`}</DialogTitle>
            <DialogDescription>
              {release
                ? many
                  ? `${slotLabel!.split(", ").length === 2 ? "Both" : "All your"} slots open for other vendors, and the organizer gets an email. If you release them by mistake, contact the organizer, who can assign them to you again.`
                  : "The slot opens for other vendors, and the organizer gets an email. If you release it by mistake, contact the organizer, who can assign it to you again."
                : `${slotLabel ? `${slotWords(slotLabel, true)} ${many ? "open" : "opens"} for other vendors and your` : "Your"} application ends. The organizer gets an email. You can apply again while the event takes applications.`}
            </DialogDescription>
          </DialogHeader>
          {error && <Alert tone="danger">{error}</Alert>}
          <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {release ? (many ? "Keep my slots" : "Keep my slot") : "Stay in"}
            </Button>
            <Button variant="danger" disabled={sending} onClick={confirm}>
              {release ? (many ? "Release slots" : "Release slot") : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// After a release or removal, the screenshots stay readable (spec §6.6).
function PaymentRecords({ proofs }: { proofs: Slot["proofs"] }) {
  return (
    <section aria-labelledby="records-h" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 md:p-5">
      <h2 id="records-h" className="text-h3">Payment records</h2>
      <p className="text-sm text-muted">Read-only. You can open them until 90 days after the event.</p>
      <ul className="flex flex-col gap-1">
        {proofs.map((p) => (
          <li key={p.id}>
            <a href={p.fileUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm underline md:min-h-0">
              {`Screenshot sent ${day(p.uploadedAt)} · ${p.methodLabel}${p.amountClaimed !== null ? ` · ${formatPeso(p.amountClaimed)}` : ""}`}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
