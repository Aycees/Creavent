"use client"

import { formatPeso, groupSlots, type EventVendors } from "@creavent/shared"
import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { EventTabs } from "./event-tabs"
import { formatDeadline } from "@/lib/event-format"
import { useEventVendors, vendorsKey } from "./queries"

type ErrorBody = { message?: string } | undefined
type Slot = EventVendors["slots"][number]
type Unassigned = EventVendors["unassigned"][number]
type Assignment = EventVendors["assignments"][number]

// Slot tiles, as in the mockup: states differ in lightness and border, not
// hue alone, and each tile says its state in hidden text.
const tileClass = {
  open: "border-dashed border-border-strong bg-surface text-muted",
  assigned: "border-border-strong bg-sunken text-ink",
  reserved: "border-inverse bg-inverse text-on-inverse",
  overdue: "border-warning bg-warning-soft text-warning-ink",
  // Hatched, so it reads apart from open (dashed) and assigned (solid).
  set_aside: "border-border bg-[repeating-linear-gradient(135deg,var(--color-sunken)_0_4px,var(--color-surface)_4px_8px)] text-muted",
}
const tileState = (s: Slot) => (s.overdue ? "overdue" : s.state)
const tileText = { open: "open", assigned: "assigned", reserved: "reserved", overdue: "payment overdue", set_aside: "set aside" }
const tileName = (s: Slot) =>
  `${s.label}, ${tileText[tileState(s)]}${s.setAsideNote ? `: ${s.setAsideNote}` : ""}${s.preferredBy ? `, preferred by ${s.preferredBy} vendor${s.preferredBy > 1 ? "s" : ""}` : ""}`
const labels = (slots: { label: string }[]) => slots.map((x) => x.label).join(", ")
// "A-02 is" or "A-02, A-03 are": a vendor's slots are named together (decision P6).
const several = (label: string) => label.includes(", ")

// /organizer/events/[id]/vendors (spec §3.4, §5, mockup OrgVendors).
export function VendorsAndSlots({ eventId }: { eventId: string }) {
  const { data, isError } = useEventVendors(eventId)
  const [assigning, setAssigning] = React.useState<Unassigned | null>(null)
  const [done, setDone] = React.useState<string | null>(null)
  const [removingUnassigned, setRemovingUnassigned] = React.useState<Unassigned | null>(null)

  if (isError) return <Alert tone="danger">We couldn&apos;t load the vendors. Refresh to try again.</Alert>
  if (data === undefined) return <p role="status" className="text-sm text-muted">Loading…</p>
  if (data === null) return <h1 className="text-h1">Event not found</h1>

  const g = data.glance
  return (
    <div className="flex flex-col gap-6">
      <EventTabs eventId={eventId} name={data.event.name} current="vendors" waiting={data.event.waitingApplications} />
      {done && <Alert tone="success">{done}</Alert>}

      <section aria-labelledby="glance-h" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="glance-h" className="text-h3">Slots at a glance</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-cap text-muted">
            <Key cls={tileClass.reserved}>{`Reserved ${g.reserved}`}</Key>
            <Key cls={tileClass.assigned}>{`Assigned ${g.assigned}`}</Key>
            <Key cls={tileClass.overdue}>{`Overdue ${g.overdue}`}</Key>
            <Key cls={tileClass.open}>{`Open ${g.open}`}</Key>
            {g.setAside > 0 && <Key cls={tileClass.set_aside}>{`Set aside ${g.setAside}`}</Key>}
          </ul>
        </div>
        {groupSlots(data.slots).map((group) => (
          <div key={group.name} className="flex flex-col gap-2">
            <h3 className="text-label font-semibold">{group.name}</h3>
            <ul className="grid grid-cols-5 gap-2 md:grid-cols-[repeat(auto-fill,minmax(64px,1fr))]">
              {group.slots.map((s) => (
                <li key={s.id} className={cn("relative grid h-12 place-items-center rounded-xs border-[1.5px] font-mono text-[12px] font-medium", tileClass[tileState(s)])}>
                  <span aria-hidden="true">{s.label}</span>
                  <span className="sr-only">{tileName(s)}</span>
                  {s.preferredBy > 0 && (
                    <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-pill bg-brand text-[11px] text-on-brand">
                      {s.preferredBy}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {data.event.preferredSlots && <p className="text-cap text-muted">A number on a slot is how many waiting vendors prefer it.</p>}
      </section>

      <section aria-labelledby="unassigned-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="unassigned-h" className="text-h3">Approved, no slot yet</h2>
          <span className="text-sm text-muted">{`${data.unassigned.length} vendor${data.unassigned.length === 1 ? "" : "s"} · ${g.open} slot${g.open === 1 ? "" : "s"} open`}</span>
        </div>
        {data.unassigned.length === 0 ? (
          <p className="text-sm text-muted">Everyone you approved has a slot.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.unassigned.map((u) => {
              const open = u.preferredSlots.filter((p) => p.state === "open")
              const gone = u.preferredSlots.filter((p) => p.state !== "open")
              const canTakePreferred = open.length > 0
              return (
                <li key={u.applicationId} className="flex flex-wrap items-center gap-3 rounded-md bg-sunken px-4 py-3">
                  <div className="min-w-0 flex-[1_1_200px]">
                    <p className="text-label font-semibold">{u.shopName}</p>
                    <p className="text-cap text-muted">
                      {u.categories.join(", ")}
                      {u.slotsRequested > 1 && ` · wants ${u.slotsRequested} slots`}
                      {open.length > 0 && (
                        <> · prefers <span className="font-mono">{labels(open)}</span></>
                      )}
                      {gone.map((p) => (
                        <span key={p.id}>
                          {" · "}
                          <span className="text-ink">{p.state === "taken" ? `Preferred ${p.label} is taken` : `${p.label} is no longer available`}</span>
                        </span>
                      ))}
                    </p>
                  </div>
                  <Button variant="danger-ghost" size="sm" className="h-11 md:h-9" onClick={() => setRemovingUnassigned(u)}>
                    Remove
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-11 md:h-9"
                    disabled={g.open === 0}
                    aria-label={canTakePreferred ? `Assign ${labels(open)} to ${u.shopName}` : `Assign ${u.slotsRequested > 1 ? "slots" : "slot"} to ${u.shopName}`}
                    onClick={() => setAssigning(u)}
                  >
                    {canTakePreferred ? <>Assign <span className="font-mono">{labels(open)}</span></> : u.slotsRequested > 1 ? "Assign slots" : "Assign slot"}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <VendorList eventId={eventId} assignments={data.assignments} onDone={setDone} />
      {data.archived.length > 0 && <PaymentRecords records={data.archived} />}

      {removingUnassigned && (
        <RemoveDialog
          eventId={eventId}
          applicationId={removingUnassigned.applicationId}
          shopName={removingUnassigned.shopName}
          slotLabel={null}
          onClose={() => setRemovingUnassigned(null)}
          onDone={setDone}
        />
      )}
      {assigning && (
        <AssignDialog
          eventId={eventId}
          vendors={data}
          vendor={assigning}
          onClose={() => setAssigning(null)}
          onAssigned={(label) => setDone(`${assigning.shopName} got ${label}. We emailed them how to pay.`)}
        />
      )}
    </div>
  )
}

function Key({ cls, children }: { cls: string; children: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("size-3.5 rounded-xs border-[1.5px]", cls)} />
      {children}
    </li>
  )
}

export function PaymentBadge({ assignment: a }: { assignment: Assignment }) {
  if (a.status === "reserved") return <Badge tone="success">Reserved</Badge>
  if (a.overdue) return <Badge tone="warning">Overdue</Badge>
  if (a.paymentStatus === "submitted") return <Badge tone="info">Proof submitted</Badge>
  if (a.paymentStatus === "rejected") return <Badge tone="danger">Proof rejected</Badge>
  return <Badge>Waiting</Badge>
}

// The Assign slot dialog (spec §5, mockup OrgAssignSlotPhone): only open
// slots, the preferred ones selected when they're still open. A vendor who
// asked for several gets up to that many, assigned together (decision P5).
function AssignDialog({
  eventId,
  vendors,
  vendor,
  onClose,
  onAssigned,
}: {
  eventId: string
  vendors: EventVendors
  vendor: Unassigned
  onClose: () => void
  onAssigned: (label: string) => void
}) {
  const queryClient = useQueryClient()
  const open = vendors.slots.filter((s) => s.state === "open")
  const max = vendor.slotsRequested
  const many = max > 1
  const [slotIds, setSlotIds] = React.useState<string[]>(() =>
    vendor.preferredSlots.filter((p) => p.state === "open" && open.some((s) => s.id === p.id)).map((p) => p.id).slice(0, max)
  )
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)
  // In slot list order, as the API sends them back.
  const picked = open.filter((s) => slotIds.includes(s.id))
  const total = picked.reduce((sum, s) => sum + (s.price ?? 0), 0)
  const preferredOpen = vendor.preferredSlots.filter((p) => p.state === "open")
  const others = preferredOpen.flatMap((p) => {
    const n = (vendors.slots.find((s) => s.id === p.id)?.preferredBy ?? 1) - 1
    return n > 0 ? [`${n} other vendor${n > 1 ? "s prefer" : " prefers"} ${p.label}`] : []
  })
  // When the dialog opened, so the time shown doesn't move while it is open.
  const [byHours] = React.useState(() => new Date(Date.now() + vendors.event.deadlineHours * 3_600_000).toISOString())
  const title = `Assign ${many ? "slots" : "slot"} to ${vendor.shopName}`

  function toggle(id: string) {
    if (!many) return setSlotIds([id])
    setSlotIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < max ? [...ids, id] : ids))
  }

  async function confirm() {
    if (picked.length === 0) return
    setSending(true)
    setError(null)
    const res = await api.POST("/api/organizer/events/{id}/assignments", {
      params: { path: { id: eventId } },
      body: { applicationId: vendor.applicationId, slotIds: picked.map((s) => s.id) },
    })
    setSending(false)
    if (!res.data) return setError((res.error as ErrorBody)?.message ?? "Something went wrong. Try again.")
    queryClient.setQueryData(vendorsKey(eventId), res.data)
    // Other screens (lists, dashboards) show the change without a reload.
    void queryClient.invalidateQueries()
    onAssigned(labels(picked))
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-label={title}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {many
              ? `${vendor.shopName} asked for ${max} slots. They get one email with the slots, the total, and how to pay.`
              : `${vendor.shopName} gets an email with the slot, amount, and how to pay.`}
          </DialogDescription>
        </DialogHeader>
        {preferredOpen.length > 0 && <Alert tone="info">{`Prefers ${labels(preferredOpen)}.${others.length ? ` ${others.join(". ")}.` : ""}`}</Alert>}
        {vendor.preferredSlots
          .filter((p) => p.state !== "open")
          .map((p) => (
            <Alert key={p.id} tone="warning">
              {p.state === "taken" ? `Preferred slot taken: ${p.label}` : `Preferred slot ${p.label} is no longer available`}
            </Alert>
          ))}
        <div
          role={many ? "group" : "radiogroup"}
          aria-label={many ? `Open slots, pick up to ${max}` : "Open slots"}
          className="flex max-h-72 flex-col gap-3 overflow-y-auto"
        >
          {groupSlots(open).map((group) => (
            <div key={group.name} className="flex flex-col gap-2">
              <p className="text-label">
                {group.name}
                <span className="text-cap text-muted">{` · ${[group.slots[0].sizeLabel, group.slots[0].price != null ? formatPeso(group.slots[0].price) : null].filter(Boolean).join(" · ")}`}</span>
              </p>
              <div className="grid grid-cols-5 gap-2">
                {group.slots.map((s) => {
                  const on = slotIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      {...(many ? { "aria-pressed": on } : { role: "radio", "aria-checked": on })}
                      aria-label={`${s.label}${s.preferredBy ? `, preferred by ${s.preferredBy}` : ""}`}
                      onClick={() => toggle(s.id)}
                      className={cn(
                        "relative grid h-12 place-items-center rounded-xs border-[1.5px] font-mono text-[12px] font-medium",
                        on ? tileClass.reserved : tileClass.open
                      )}
                    >
                      {s.label}
                      {s.preferredBy > 0 && (
                        <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-pill bg-brand text-[11px] text-on-brand">
                          {s.preferredBy}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <p className="text-cap text-muted" aria-live="polite">
            {many ? `${picked.length} of ${max} picked. Only open slots are shown.` : "Only open slots are shown."}
          </p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Amount due</dt>
          <dd className="tabular-nums">{picked.length ? formatPeso(total) : "Pick a slot"}</dd>
          <dt className="text-muted">Pay within</dt>
          <dd>{`${vendors.event.deadlineHours} hours, by ${formatDeadline(byHours)} at the latest`}</dd>
        </dl>
        {error && <Alert tone="danger">{error}</Alert>}
        <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={picked.length === 0 || sending} onClick={confirm}>
            {picked.length ? `Assign ${labels(picked)}` : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type ListFilter = "all" | "attention" | "reserved"
const needsAttention = (a: Assignment) => a.status === "assigned" && (a.overdue || a.paymentStatus === "submitted" || a.paymentStatus === "rejected")

// Every vendor with a slot, with payment and the next step (mockup OrgVendors).
function VendorList({ eventId, assignments, onDone }: { eventId: string; assignments: Assignment[]; onDone: (message: string) => void }) {
  const [filter, setFilter] = React.useState<ListFilter>("all")
  const [reviewing, setReviewing] = React.useState<Assignment | null>(null)
  const [marking, setMarking] = React.useState<Assignment | null>(null)
  const [removing, setRemoving] = React.useState<Assignment | null>(null)
  const counts = { all: assignments.length, attention: assignments.filter(needsAttention).length, reserved: assignments.filter((a) => a.status === "reserved").length }
  const shown = assignments.filter((a) => filter === "all" || (filter === "attention" ? needsAttention(a) : a.status === "reserved"))
  return (
    <section aria-labelledby="slots-h" className="flex flex-col gap-3">
      <h2 id="slots-h" className="text-h3">Vendors with a slot</h2>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        <Chip pressed={filter === "all"} count={counts.all} onClick={() => setFilter("all")}>All</Chip>
        <Chip pressed={filter === "attention"} count={counts.attention} onClick={() => setFilter("attention")}>Needs attention</Chip>
        <Chip pressed={filter === "reserved"} count={counts.reserved} onClick={() => setFilter("reserved")}>Reserved</Chip>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted">{assignments.length === 0 ? "No slots assigned yet." : "None here."}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
          {shown.map((a) => (
            <li key={a.id} aria-label={`${a.shopName}, ${a.slotLabel}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:flex-nowrap">
              <span className="w-12 flex-none font-mono text-sm">{a.slotLabel}</span>
              <div className="min-w-0 flex-[1_1_160px]">
                <p className="text-label font-semibold">{a.shopName}</p>
                <p className="text-cap text-muted">
                  <span className="tabular-nums">{formatPeso(a.amountDue)}</span>
                  {a.status === "reserved" ? (a.paymentNote ? ` · ${a.paymentNote}` : "") : ` · ${a.overdue ? "was due" : "due"} ${formatDeadline(a.deadlineAt)}`}
                </p>
                {a.paymentStatus === "rejected" && a.proof?.rejectionReason && <p className="text-cap text-muted">{`Proof rejected: ${a.proof.rejectionReason}`}</p>}
              </div>
              <PaymentBadge assignment={a} />
              <div className="flex w-full gap-2 md:w-auto">
                {a.status === "assigned" &&
                  (a.paymentStatus === "submitted" && a.proof ? (
                    <Button size="sm" className="h-11 flex-1 md:h-9 md:flex-none" onClick={() => setReviewing(a)}>Review proof</Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-11 flex-1 md:h-9 md:flex-none" onClick={() => setMarking(a)}>Mark paid</Button>
                  ))}
                <Button variant="danger-ghost" size="sm" className="h-11 flex-1 md:h-9 md:flex-none" onClick={() => setRemoving(a)}>Remove</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {reviewing && <ReviewDialog eventId={eventId} assignment={reviewing} onClose={() => setReviewing(null)} onDone={onDone} />}
      {marking && <MarkPaidDialog eventId={eventId} assignment={marking} onClose={() => setMarking(null)} onDone={onDone} />}
      {removing && (
        <RemoveDialog
          eventId={eventId}
          applicationId={removing.applicationId}
          shopName={removing.shopName}
          slotLabel={removing.slotLabel}
          onClose={() => setRemoving(null)}
          onDone={onDone}
        />
      )}
    </section>
  )
}

function useSave(eventId: string) {
  const queryClient = useQueryClient()
  return (data: EventVendors) => {
    queryClient.setQueryData(vendorsKey(eventId), data)
    // Other screens (Applications, the dashboard) show it without a reload.
    void queryClient.invalidateQueries()
  }
}

// The proof review panel (spec §6.3, mockup OrgVendorsPhone).
function ReviewDialog({ eventId, assignment: a, onClose, onDone }: { eventId: string; assignment: Assignment; onClose: () => void; onDone: (m: string) => void }) {
  const save = useSave(eventId)
  const proof = a.proof!
  const [rejecting, setRejecting] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)

  async function approve() {
    setSending(true)
    setError(null)
    const res = await api.POST("/api/organizer/events/{id}/proofs/{proofId}/approve", { params: { path: { id: eventId, proofId: proof.id } }, body: {} })
    setSending(false)
    if (!res.data) return setError((res.error as ErrorBody)?.message ?? "Something went wrong. Try again.")
    save(res.data)
    onDone(`${a.shopName} is confirmed. ${a.slotLabel} ${several(a.slotLabel) ? "are" : "is"} reserved.`)
    onClose()
  }

  async function reject() {
    setError(null)
    if (!reason.trim()) return setError('Say what to fix, for example "Short by ₱100"')
    setSending(true)
    const res = await api.POST("/api/organizer/events/{id}/proofs/{proofId}/reject", { params: { path: { id: eventId, proofId: proof.id } }, body: { reason: reason.trim() } })
    setSending(false)
    if (!res.data) return setError((res.error as ErrorBody)?.message ?? "Something went wrong. Try again.")
    save(res.data)
    onDone(`We told ${a.shopName} what to fix. They can upload new proof.`)
    onClose()
  }

  const short = proof.amountClaimed !== null && proof.amountClaimed < a.amountDue
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-label={`Review payment: ${a.shopName}, ${a.slotLabel}`}>
        <DialogHeader>
          <DialogTitle>{`Review payment: ${a.shopName}, ${a.slotLabel}`}</DialogTitle>
          <DialogDescription>Check the reference in that account&apos;s history (for example, your GCash) before you approve.</DialogDescription>
        </DialogHeader>
        <a href={proof.fileUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border bg-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element -- a private image behind a short-lived address */}
          <img src={proof.fileUrl} alt="" className="max-h-64 w-full object-contain" />
          <span className="block px-3 py-2 text-cap">Open the receipt full size</span>
        </a>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">Amount due</dt>
          <dd className="font-semibold tabular-nums">{formatPeso(a.amountDue)}</dd>
          <dt className="text-muted">Vendor sent</dt>
          <dd className={cn("tabular-nums", short && "text-danger-ink")}>{proof.amountClaimed === null ? "Not given" : formatPeso(proof.amountClaimed)}</dd>
          <dt className="text-muted">Paid with</dt>
          <dd>{proof.methodLabel}</dd>
          <dt className="text-muted">Reference</dt>
          <dd className="font-mono">{proof.referenceNumber ?? "None given"}</dd>
          {proof.note && (
            <>
              <dt className="text-muted">Note</dt>
              <dd>{proof.note}</dd>
            </>
          )}
        </dl>
        {rejecting && (
          <div className="flex flex-col gap-2">
            <label htmlFor="reject-reason" className="text-label">What should they fix?</label>
            <Textarea id="reject-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="For example, short by ₱100, or the screenshot is unreadable" />
          </div>
        )}
        {error && <p className="text-help text-danger-ink">{error}</p>}
        <DialogFooter className="flex flex-row gap-2 md:justify-end">
          {rejecting ? (
            <>
              <Button variant="secondary" className="flex-1 md:flex-none" onClick={() => setRejecting(false)}>Back</Button>
              <Button variant="danger" className="flex-[2] md:flex-none" disabled={sending} onClick={reject}>Reject proof</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" className="flex-1 md:flex-none" onClick={() => setRejecting(true)}>Reject</Button>
              <Button className="flex-[2] md:flex-none" disabled={sending} onClick={approve}>Approve payment</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Approve without a proof image, with a note (spec §6.3).
function MarkPaidDialog({ eventId, assignment: a, onClose, onDone }: { eventId: string; assignment: Assignment; onClose: () => void; onDone: (m: string) => void }) {
  const save = useSave(eventId)
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)

  async function confirm() {
    setError(null)
    if (!note.trim()) return setError('Add a note, for example "Paid cash at the office"')
    setSending(true)
    const res = await api.POST("/api/organizer/events/{id}/assignments/{assignmentId}/mark-paid", {
      params: { path: { id: eventId, assignmentId: a.id } },
      body: { note: note.trim(), method: "cash" },
    })
    setSending(false)
    if (!res.data) return setError((res.error as ErrorBody)?.message ?? "Something went wrong. Try again.")
    save(res.data)
    onDone(`${a.shopName} is confirmed. ${a.slotLabel} ${several(a.slotLabel) ? "are" : "is"} reserved.`)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-label={`Mark ${a.shopName} as paid?`}>
        <DialogHeader>
          <DialogTitle>{`Mark ${a.shopName} as paid?`}</DialogTitle>
          <DialogDescription>{`For a payment without a screenshot, like cash on site. ${a.slotLabel} ${several(a.slotLabel) ? "become" : "becomes"} reserved, and we email ${a.shopName}.`}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor="paid-note" className="text-label">Note</label>
          <Textarea id="paid-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="For example, paid cash at the office" />
        </div>
        {error && <p className="text-help text-danger-ink">{error}</p>}
        <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={sending} onClick={confirm}>Mark paid</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Remove a vendor at any time (spec §6.6, flow 9): choose whether they can
// apply again. Their payment records are kept, read-only.
export function RemoveDialog({
  eventId,
  applicationId,
  shopName,
  slotLabel,
  onClose,
  onDone,
}: {
  eventId: string
  applicationId: string
  shopName: string
  slotLabel: string | null
  onClose: () => void
  onDone: (m: string) => void
}) {
  const save = useSave(eventId)
  const [canReapply, setCanReapply] = React.useState<boolean | null>(null)
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)

  async function confirm() {
    setError(null)
    if (canReapply === null) return setError("Choose whether they can apply again")
    setSending(true)
    const res = await api.POST("/api/organizer/events/{id}/applications/{applicationId}/remove", {
      params: { path: { id: eventId, applicationId } },
      body: { canReapply, note },
    })
    setSending(false)
    if (!res.data) return setError((res.error as ErrorBody)?.message ?? "Something went wrong. Try again.")
    save(res.data)
    onDone(slotLabel ? `${shopName} is removed. ${slotLabel} ${several(slotLabel) ? "are" : "is"} open again.` : `${shopName} is removed.`)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-label={`Remove ${shopName}?`}>
        <DialogHeader>
          <DialogTitle>{`Remove ${shopName}?`}</DialogTitle>
          <DialogDescription>
            {`${slotLabel ? `${slotLabel} ${several(slotLabel) ? "open" : "opens"} again. ` : ""}We email ${shopName}. Their payment records stay readable for both of you. Refunds are between you and them.`}
          </DialogDescription>
        </DialogHeader>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label">Can they apply to this event again?</legend>
          {[
            { value: true, label: "Yes, they can apply again" },
            { value: false, label: "No, they can't apply again" },
          ].map((o) => (
            <label key={String(o.value)} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border-strong px-4 has-checked:border-2 has-checked:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
              <input type="radio" name="can-reapply" checked={canReapply === o.value} onChange={() => setCanReapply(o.value)} className="size-5 accent-ink" />
              <span className="text-label">{o.label}</span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-2">
          <label htmlFor="remove-note" className="text-label">
            Note to the vendor <span className="font-normal text-muted">(optional)</span>
          </label>
          <Textarea id="remove-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <p className="text-help text-danger-ink">{error}</p>}
        <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={sending} onClick={confirm}>Remove vendor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const endedLabels = { released: "Released", removed: "Removed", canceled: "Canceled", assigned: "Assigned", reserved: "Reserved" } as const
const recordDay = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" })

// Payment records of vendors who released or were removed (spec §6.6):
// read-only, kept for disputes until retention ends.
function PaymentRecords({ records }: { records: EventVendors["archived"] }) {
  return (
    <section aria-labelledby="records-h" className="flex flex-col gap-3">
      <div>
        <h2 id="records-h" className="text-h3">Payment records</h2>
        <p className="text-sm text-muted">From vendors who released their slot or were removed. Read-only.</p>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
        {records.map((r) => (
          <li key={r.assignmentId} className="flex flex-col gap-1 px-4 py-3">
            <p className="text-label font-semibold">{`${r.shopName} · ${r.slotLabel} · ${endedLabels[r.status]}`}</p>
            {r.proofs.map((p) => (
              <a key={p.id} href={p.fileUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm underline md:min-h-0">
                {`Screenshot sent ${recordDay.format(new Date(p.uploadedAt))} · ${p.methodLabel}${p.amountClaimed !== null ? ` · ${formatPeso(p.amountClaimed)}` : ""}`}
              </a>
            ))}
          </li>
        ))}
      </ul>
    </section>
  )
}
