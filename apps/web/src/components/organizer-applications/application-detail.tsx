"use client"

import { formatPeso, type ApplicationDetail } from "@creavent/shared"
import { CaretRightIcon, FileTextIcon, ImageIcon, PhoneIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import * as React from "react"

import { ReapplyControl } from "@/components/organizer-vendors/applications-review"
import { PaymentBadge, RemoveDialog } from "@/components/organizer-vendors/vendors-slots"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { formatDay, formatDeadline } from "@/lib/event-format"
import { manilaDay, useApplicationDetail, waitingFor } from "./queries"

type ErrorBody = { message?: string } | undefined

const stageBadge: Record<ApplicationDetail["stage"], { label: string; tone: "info" | "success" | "warning" | "neutral" }> = {
  submitted: { label: "Waiting", tone: "info" },
  approved: { label: "Approved, no slot yet", tone: "info" },
  slot_assigned: { label: "Slot assigned", tone: "warning" },
  reserved: { label: "Reserved", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  removed: { label: "Removed", tone: "neutral" },
}

const historyVerbs: Record<string, string> = { withdrawn: "withdrew", declined: "was declined on", removed: "was removed from", submitted: "applied", approved: "was approved for" }

// /organizer/applications/[id]: one application in full, with the actions for
// its stage (decided 2026-11-15, mockup OrgApplicationDetail).
export function ApplicationDetailPage({ id }: { id: string }) {
  const { data: a, isError } = useApplicationDetail(id)
  const [now] = React.useState(() => Date.now())
  const [removing, setRemoving] = React.useState(false)
  const [done, setDone] = React.useState<string | null>(null)

  if (isError) return <Alert tone="danger">We couldn&apos;t load this application. Refresh to try again.</Alert>
  if (a === undefined) return <p role="status" className="text-sm text-muted">Loading…</p>
  if (a === null) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-h1">Application not found</h1>
        <Button asChild variant="secondary"><Link href="/organizer/applications">See all applications</Link></Button>
      </div>
    )
  }
  const initials = a.vendor.shopName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  const badge = a.stage === "submitted" ? `Waiting · ${waitingFor(a.submittedAt, now).replace("Waiting ", "")}` : stageBadge[a.stage].label

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="flex items-center justify-between gap-3 text-sm text-muted">
        <span className="flex min-w-0 items-center gap-2">
          <Link href="/organizer/applications" className="hover:text-ink">Applications</Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-ink">{a.vendor.shopName}</span>
        </span>
        {a.nextWaitingId && (
          <Link href={`/organizer/applications/${a.nextWaitingId}`} className="inline-flex min-h-11 flex-none items-center gap-1 hover:text-ink">
            Next waiting <CaretRightIcon aria-hidden="true" className="size-4" />
          </Link>
        )}
      </nav>

      <header className="flex flex-wrap items-start gap-4 md:gap-5">
        {a.vendor.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized
          <img src={a.vendor.avatarUrl} alt="" className="size-14 flex-none rounded-pill object-cover md:size-22" />
        ) : (
          <span aria-hidden="true" className="grid size-14 flex-none place-items-center rounded-pill bg-sunken text-h3 md:size-22 md:text-h2">{initials}</span>
        )}
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-h1">{a.vendor.shopName}</h1>
            <Badge tone={stageBadge[a.stage].tone}>{badge}</Badge>
          </div>
          <p className="text-sm text-muted">
            {`Applied ${manilaDay(a.submittedAt)} to `}
            <Link href={`/organizer/events/${a.event.id}/applications`} className="underline">{a.event.name}</Link>
            {a.event.startDate ? `, ${formatDay(a.event.startDate)}${a.event.endDate && a.event.endDate !== a.event.startDate ? ` to ${formatDay(a.event.endDate)}` : ""}` : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {a.categories.map((c) => <span key={c.name} className="rounded-sm bg-sunken px-2.5 py-1 text-sm">{c.name}</span>)}
          </div>
        </div>
        {a.vendor.slug && (
          <Button asChild variant="secondary" className="max-md:w-full">
            <Link href={`/vendors/${a.vendor.slug}`}>View shop page</Link>
          </Button>
        )}
      </header>

      {done && <Alert tone="success">{done}</Alert>}

      <div className="flex flex-col gap-5 md:grid md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-6">
        <div className="flex flex-col gap-5 md:col-start-2 md:row-start-1">
          {a.stage === "submitted" && <DecisionPanel application={a} onDone={setDone} />}
          {a.stage === "approved" && (
            <section aria-labelledby="next-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5">
              <h2 id="next-h" className="text-h3">Next: assign a slot</h2>
              <p className="text-sm text-muted">{nextStep(a)}</p>
              <Button asChild><Link href={`/organizer/events/${a.event.id}/vendors`}>Assign a slot</Link></Button>
            </section>
          )}
          {a.assignment && (
            <section aria-labelledby="pay-h" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 md:p-5">
              <h2 id="pay-h" className="text-h3">Slot and payment</h2>
              <p className="flex items-center justify-between gap-3 text-sm">
                <span><span className="font-mono">{a.assignment.slotLabel}</span>{` · ${formatPeso(a.assignment.amountDue)}`}</span>
                <PaymentBadge assignment={{ status: a.assignment.status, overdue: a.assignment.status === "assigned" && new Date(a.assignment.deadlineAt).getTime() < now && a.assignment.paymentStatus !== "submitted" && a.assignment.paymentStatus !== "approved", paymentStatus: a.assignment.paymentStatus } as never} />
              </p>
              {a.assignment.status === "assigned" && <p className="text-cap text-muted">{`Pay by ${formatDeadline(a.assignment.deadlineAt)}`}</p>}
              <Button asChild variant="secondary" size="sm" className="h-11 self-start md:h-9">
                <Link href={`/organizer/events/${a.event.id}/vendors`}>Review on Vendors and slots</Link>
              </Button>
            </section>
          )}
          {a.stage === "removed" && (
            <section aria-labelledby="rm-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5">
              <h2 id="rm-h" className="text-h3">Removed</h2>
              {a.removalNote && <p className="text-sm">{a.removalNote}</p>}
              <ReapplyControl application={{ id: a.id, canReapply: a.canReapply }} eventId={a.event.id} />
            </section>
          )}

          <section aria-labelledby="ct-h" className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-4 md:p-5">
            <h2 id="ct-h" className="text-h3">Contact</h2>
            <p className="text-sm">{a.vendor.fullName}</p>
            {a.vendor.phone ? (
              <div className="flex gap-2">
                <Button asChild variant="secondary" size="sm" className="h-11 flex-1 md:h-9">
                  <a href={`tel:${a.vendor.phone}`}><PhoneIcon aria-hidden="true" />{`Call ${a.vendor.phone}`}</a>
                </Button>
                <Button asChild variant="ghost" size="sm" className="h-11 md:h-9">
                  <a href={`sms:${a.vendor.phone}`}>Text</a>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted">No mobile number.</p>
            )}
          </section>

          <section aria-labelledby="hist-h" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 md:p-5">
            <h2 id="hist-h" className="text-h3">At this event</h2>
            <p className="text-sm">{`Applied ${manilaDay(a.submittedAt)}${a.decidedAt ? `, decided ${manilaDay(a.decidedAt)}` : ""}.`}</p>
            {a.history.map((h) => (
              <p key={h.id} className="text-cap text-muted">{`Earlier: ${historyVerbs[h.status] ?? h.status} an application on ${manilaDay(h.submittedAt)}.`}</p>
            ))}
          </section>

          {(a.stage === "approved" || a.stage === "slot_assigned" || a.stage === "reserved") && (
            <Button variant="danger-ghost" size="sm" className="h-11 self-start md:h-9" onClick={() => setRemoving(true)}>
              Remove from this event
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-5 md:col-start-1 md:row-start-1">
          {(a.vendor.description || a.vendor.photoUrls.length > 0 || a.vendor.products) && (
            <section aria-labelledby="shop-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-6">
              <h2 id="shop-h" className="text-h3">About the shop</h2>
              {a.vendor.description && <p className="text-sm whitespace-pre-line">{a.vendor.description}</p>}
              {a.vendor.photoUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                  {a.vendor.photoUrls.slice(0, 4).map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized
                    <img key={url} src={url} alt="" className="aspect-square w-full rounded-md object-cover" />
                  ))}
                </div>
              )}
              {a.vendor.products && <p className="text-sm text-muted">{`Products: ${a.vendor.products}`}</p>}
            </section>
          )}

          <section aria-labelledby="docs-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 id="docs-h" className="text-h3">Documents</h2>
              {a.missingDocuments.length === 0 ? <Badge tone="success">All required uploaded</Badge> : <Badge tone="danger">{`Missing: ${a.missingDocuments.join(", ")}`}</Badge>}
            </div>
            {a.documents.length === 0 ? (
              <p className="text-sm text-muted">No documents uploaded.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {a.documents.map((d) => (
                  <li key={d.id}>
                    <a href={d.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-3 rounded-md border border-border p-3 hover:border-border-strong">
                      <span aria-hidden="true" className={`grid size-12 flex-none place-items-center rounded-sm ${d.isPdf ? "bg-danger-soft text-danger-ink" : "bg-sunken text-muted"}`}>
                        {d.isPdf ? <span className="text-cap font-semibold">PDF</span> : <ImageIcon className="size-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-label font-semibold">{d.name}</span>
                        <span className="block text-cap text-muted">{`${d.isPdf ? "PDF, downloads" : "Photo, opens full size"} · uploaded ${manilaDay(d.uploadedAt)}`}</span>
                      </span>
                      <FileTextIcon aria-hidden="true" className="size-5 text-muted" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {a.preferredSlots.length > 0 && (
            <section aria-labelledby="slot-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-6">
              <div className="flex flex-col gap-1">
                <h2 id="slot-h" className="text-h3">{a.preferredSlots.length > 1 ? "Preferred slots" : "Preferred slot"}</h2>
                {a.slotsRequested > 1 && <p className="text-sm text-muted">{`Wants ${a.slotsRequested} slots`}</p>}
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {a.preferredSlots.map((p) => (
                  <li key={p.id}>
                    <span className="font-mono">{p.label}</span>
                    {[p.section, p.sizeLabel, p.price != null ? formatPeso(p.price) : null].filter(Boolean).map((x) => ` · ${x}`).join("")}
                    {` · ${p.state === "open" ? "open" : p.state === "taken" ? "taken" : "no longer available"}`}
                  </li>
                ))}
              </ul>
              {a.event.vendorFloorPlanUrl && (
                <a href={a.event.vendorFloorPlanUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
                  <img src={a.event.vendorFloorPlanUrl} alt="Vendor floor plan. Opens full size." className="w-full object-contain" />
                </a>
              )}
              {a.preferredSlots
                .filter((p) => p.preferredByOthers > 0)
                .map((p) => (
                  <p key={p.id} className="text-cap text-muted">
                    {`${a.preferredSlots.length > 1 ? `${p.label} is also` : "Also"} preferred by ${p.preferredByOthers} other vendor${p.preferredByOthers > 1 ? "s" : ""}. A preference holds nothing until you assign it.`}
                  </p>
                ))}
            </section>
          )}

          {a.note && (
            <section aria-labelledby="note-h" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 md:p-6">
              <h2 id="note-h" className="text-h3">Note from the vendor</h2>
              <p className="text-sm whitespace-pre-line">{a.note}</p>
              <p className="text-cap text-muted">{`Accepted your cancellation and withdrawal policy on ${manilaDay(a.policyAcceptedAt)}.`}</p>
            </section>
          )}
        </div>
      </div>

      {removing && (
        <RemoveDialog
          eventId={a.event.id}
          applicationId={a.id}
          shopName={a.vendor.shopName}
          slotLabel={a.assignment?.slotLabel ?? null}
          onClose={() => setRemoving(false)}
          onDone={setDone}
        />
      )}
    </div>
  )
}

// Approve or decline from the detail page, with an optional note (spec §3.3).
function DecisionPanel({ application: a, onDone }: { application: ApplicationDetail; onDone: (m: string) => void }) {
  const queryClient = useQueryClient()
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)

  async function decide(action: "approve" | "decline") {
    setSending(true)
    setError(null)
    const path = action === "approve" ? "/api/organizer/events/{id}/applications/{applicationId}/approve" : "/api/organizer/events/{id}/applications/{applicationId}/decline"
    const res = await api.POST(path, { params: { path: { id: a.event.id, applicationId: a.id } }, body: { note } })
    setSending(false)
    if (!res.data) return setError((res.error as ErrorBody)?.message ?? "Something went wrong. Try again.")
    void queryClient.invalidateQueries()
    onDone(action === "approve" ? `${a.vendor.shopName} is approved. Assign them a slot next.` : `${a.vendor.shopName} is declined. They can apply again.`)
  }

  return (
    <section aria-labelledby="dec-h" className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface p-4 shadow-md md:p-5">
      <h2 id="dec-h" className="text-h3">Your decision</h2>
      {a.categories.map((c) => (
        <p key={c.name} className="rounded-md bg-sunken px-3 py-2.5 text-sm tabular-nums">
          {c.max === null ? `${c.name}: ${c.approved} accepted` : `${c.name}: ${c.approved} of ${c.max} accepted`}
        </p>
      ))}
      <div className="flex flex-col gap-2">
        <label htmlFor="detail-note" className="text-label">
          Note to the vendor <span className="font-normal text-muted">(optional)</span>
        </label>
        <Textarea id="detail-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="For example, see you at the entrance row." />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" disabled={sending} onClick={() => decide("decline")}>Decline</Button>
        <Button className="flex-[2]" disabled={sending} onClick={() => decide("approve")}>Approve</Button>
      </div>
      <p className="text-cap text-muted">We email them either way. After you approve, assign their slot on Vendors and slots.</p>
    </section>
  )
}

// "They prefer B-03, which is still open." The next step on an approved
// application with no slot.
function nextStep(a: ApplicationDetail) {
  const open = a.preferredSlots.filter((p) => p.state === "open").map((p) => p.label)
  const want = a.slotsRequested > 1 ? `They want ${a.slotsRequested} slots. ` : ""
  if (open.length === 0) return `${want}Pick ${a.slotsRequested > 1 ? "open slots" : "an open slot"} for them.`
  return `${want}They prefer ${open.join(", ")}, ${open.length > 1 ? "which are" : "which is"} still open.`
}
