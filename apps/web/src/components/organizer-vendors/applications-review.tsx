"use client"

import { type ApplicationStatus, type EventApplications, type OrganizerApplication } from "@creavent/shared"
import { DownloadSimpleIcon, FileTextIcon, ImageIcon, PhoneIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { EventTabs } from "./event-tabs"
import { applicationsKey, useEventApplications } from "./queries"

type ErrorBody = { message?: string } | undefined
type Filter = ApplicationStatus | "all"

const filterLabels: Record<Filter, string> = {
  submitted: "Waiting",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
  removed: "Removed",
  all: "All",
}

const dateFormat = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" })

// /organizer/events/[id]/applications (spec §3.3, flow 5).
export function ApplicationsReview({ eventId }: { eventId: string }) {
  const { data, isError } = useEventApplications(eventId)
  const [filter, setFilter] = React.useState<Filter>("submitted")
  const [done, setDone] = React.useState<string | null>(null)

  if (isError) return <Alert tone="danger">We couldn&apos;t load the applications. Refresh to try again.</Alert>
  if (data === undefined) return <p role="status" className="text-sm text-muted">Loading…</p>
  if (data === null) return <h1 className="text-h1">Event not found</h1>

  const count = (f: Filter) => (f === "all" ? data.applications.length : data.applications.filter((a) => a.status === f).length)
  const shown = data.applications.filter((a) => filter === "all" || a.status === filter)
  const filters: Filter[] = ["submitted", "approved", "declined", "withdrawn", "removed", "all"]

  return (
    <div className="flex flex-col gap-6">
      <EventTabs eventId={eventId} name={data.event.name} current="applications" waiting={count("submitted")} />

      <section aria-label="Category counters" className="flex flex-wrap gap-2">
        {data.counters.map((c) => (
          <span
            key={c.categoryId}
            className={`rounded-md px-3 py-1.5 text-sm tabular-nums ${c.max !== null && c.approved >= c.max ? "bg-warning-soft text-warning-ink" : "bg-sunken"}`}
          >
            {c.max === null ? `${c.name}: ${c.approved} accepted` : `${c.name}: ${c.approved} of ${c.max} accepted`}
          </span>
        ))}
      </section>

      {done && <Alert tone="success">{done}</Alert>}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {filters.map((f) => (
          <Chip key={f} pressed={filter === f} count={count(f)} onClick={() => setFilter(f)}>
            {filterLabels[f]}
          </Chip>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-body text-muted">
          {filter === "submitted" ? "No applications waiting. New ones show up here, and we email you each one." : "None here."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((a) => (
            <li key={a.id}>
              <ApplicationCard application={a} eventId={eventId} preferredSlots={data.event.preferredSlots} onDecided={setDone} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ApplicationCard({
  application: a,
  eventId,
  preferredSlots,
  onDecided,
}: {
  application: OrganizerApplication
  eventId: string
  preferredSlots: boolean
  onDecided: (message: string) => void
}) {
  const id = React.useId()
  const [deciding, setDeciding] = React.useState<"approve" | "decline" | null>(null)
  return (
    <article aria-labelledby={id} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
          <h2 id={id} className="text-h3">
            {a.vendor.slug ? (
              <Link href={`/vendors/${a.vendor.slug}`} className="hover:underline">
                {a.vendor.shopName}
              </Link>
            ) : (
              a.vendor.shopName
            )}
          </h2>
          <p className="text-sm text-muted">
            {`${a.categories.map((c) => c.name).join(", ")} · applied ${dateFormat.format(new Date(a.submittedAt))}`}
          </p>
        </div>
        {a.status !== "submitted" && <span className="rounded-pill bg-sunken px-3 py-1 text-cap">{filterLabels[a.status]}</span>}
      </div>

      <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-[auto_1fr]">
        <dt className="text-muted">Contact</dt>
        <dd className="flex flex-wrap items-center gap-x-2">
          {a.vendor.fullName}
          {a.vendor.phone && (
            <a href={`tel:${a.vendor.phone}`} className="inline-flex min-h-11 items-center gap-1 font-medium tabular-nums md:min-h-0">
              <PhoneIcon aria-hidden="true" className="size-4" />
              {a.vendor.phone}
            </a>
          )}
        </dd>
        {preferredSlots || a.preferredSlot ? (
          <>
            <dt className="text-muted">Preferred slot</dt>
            <dd>
              {a.preferredSlot === null ? (
                "No preference"
              ) : a.preferredSlot.state === "removed" ? (
                `${a.preferredSlot.label} is no longer available`
              ) : (
                <>
                  <span className="font-mono">{a.preferredSlot.label}</span>
                  {a.preferredSlot.state === "taken" && <span className="text-muted"> · taken by another vendor</span>}
                </>
              )}
            </dd>
          </>
        ) : null}
        <dt className="text-muted">Documents</dt>
        <dd>
          {a.documents.length === 0 ? (
            <span className="text-muted">None uploaded</span>
          ) : (
            <ul className="flex flex-col gap-1">
              {a.documents.map((d) => (
                <li key={d.id}>
                  <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 hover:underline md:min-h-0">
                    {d.isPdf ? <FileTextIcon aria-hidden="true" className="size-4" /> : <ImageIcon aria-hidden="true" className="size-4" />}
                    {d.name}
                    {d.isPdf && <DownloadSimpleIcon aria-label="downloads" className="size-4 text-muted" />}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </dd>
        {a.note && (
          <>
            <dt className="text-muted">Note</dt>
            <dd className="whitespace-pre-line">{a.note}</dd>
          </>
        )}
        {a.decisionNote && (
          <>
            <dt className="text-muted">Your note</dt>
            <dd className="whitespace-pre-line">{a.decisionNote}</dd>
          </>
        )}
      </dl>

      {a.status === "removed" && <ReapplyControl application={a} eventId={eventId} />}
      {a.status === "submitted" && (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1 md:flex-none" onClick={() => setDeciding("decline")}>
            Decline
          </Button>
          <Button className="flex-[2] md:flex-none" onClick={() => setDeciding("approve")}>
            Approve
          </Button>
        </div>
      )}
      {deciding && (
        <DecisionDialog application={a} eventId={eventId} action={deciding} onClose={() => setDeciding(null)} onDecided={onDecided} />
      )}
    </article>
  )
}

function DecisionDialog({
  application: a,
  eventId,
  action,
  onClose,
  onDecided,
}: {
  application: OrganizerApplication
  eventId: string
  action: "approve" | "decline"
  onClose: () => void
  onDecided: (message: string) => void
}) {
  const queryClient = useQueryClient()
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)
  const verb = action === "approve" ? "Approve" : "Decline"

  async function confirm() {
    setSending(true)
    setError(null)
    const path = action === "approve" ? "/api/organizer/events/{id}/applications/{applicationId}/approve" : "/api/organizer/events/{id}/applications/{applicationId}/decline"
    const res = await api.POST(path, { params: { path: { id: eventId, applicationId: a.id } }, body: { note } })
    setSending(false)
    if (!res.data) return setError((res.error as ErrorBody)?.message ?? "Something went wrong. Try again.")
    queryClient.setQueryData<EventApplications>(applicationsKey(eventId), res.data)
    onDecided(
      action === "approve"
        ? `${a.vendor.shopName} is approved. Assign them a slot on Vendors and slots.`
        : `${a.vendor.shopName} is declined. They can apply again.`
    )
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`${verb} ${a.vendor.shopName}?`}</DialogTitle>
          <DialogDescription>
            {action === "approve"
              ? "We email them that they're approved. You assign their slot next."
              : "We email them, with your note if you add one."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor="decision-note" className="text-label">
            Note to the vendor <span className="font-normal text-muted">(optional)</span>
          </label>
          <Textarea id="decision-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={action === "approve" ? "primary" : "danger"} disabled={sending} onClick={confirm}>
            {verb}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Allow or block a removed vendor from applying again (spec §3.3).
function ReapplyControl({ application: a, eventId }: { application: OrganizerApplication; eventId: string }) {
  const queryClient = useQueryClient()
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)

  async function change(canReapply: boolean) {
    setSending(true)
    setError(null)
    const res = await api.POST("/api/organizer/events/{id}/applications/{applicationId}/reapply", {
      params: { path: { id: eventId, applicationId: a.id } },
      body: { canReapply },
    })
    setSending(false)
    if (!res.data) return setError((res.error as ErrorBody)?.message ?? "Something went wrong. Try again.")
    queryClient.setQueryData<EventApplications>(applicationsKey(eventId), res.data)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md bg-sunken px-4 py-3">
      <span className="flex-1 text-sm">{a.canReapply ? "Can apply again" : "Can't apply again"}</span>
      <Button variant="secondary" size="sm" className="h-11 md:h-9" disabled={sending} onClick={() => change(!a.canReapply)}>
        {a.canReapply ? "Block them from applying again" : "Let them apply again"}
      </Button>
      {error && <p className="w-full text-help text-danger-ink">{error}</p>}
    </div>
  )
}
