"use client"

import { formatPeso, groupSlots, type EventVendors } from "@creavent/shared"
import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
}
const tileState = (s: Slot) => (s.overdue ? "overdue" : s.state)
const tileText = { open: "open", assigned: "assigned", reserved: "reserved", overdue: "payment overdue" }

// /organizer/events/[id]/vendors (spec §3.4, §5, mockup OrgVendors).
export function VendorsAndSlots({ eventId }: { eventId: string }) {
  const { data, isError } = useEventVendors(eventId)
  const [assigning, setAssigning] = React.useState<Unassigned | null>(null)
  const [done, setDone] = React.useState<string | null>(null)

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
          </ul>
        </div>
        {groupSlots(data.slots).map((group) => (
          <div key={group.name} className="flex flex-col gap-2">
            <h3 className="text-label font-semibold">{group.name}</h3>
            <ul className="grid grid-cols-5 gap-2 md:grid-cols-[repeat(auto-fill,minmax(64px,1fr))]">
              {group.slots.map((s) => (
                <li key={s.id} className={cn("relative grid h-12 place-items-center rounded-xs border-[1.5px] font-mono text-[12px] font-medium", tileClass[tileState(s)])}>
                  <span aria-hidden="true">{s.label}</span>
                  <span className="sr-only">{`${s.label}, ${tileText[tileState(s)]}${s.preferredBy ? `, preferred by ${s.preferredBy} vendor${s.preferredBy > 1 ? "s" : ""}` : ""}`}</span>
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
              const canTakePreferred = u.preferredSlot?.state === "open"
              return (
                <li key={u.applicationId} className="flex flex-wrap items-center gap-3 rounded-md bg-sunken px-4 py-3">
                  <div className="min-w-0 flex-[1_1_200px]">
                    <p className="text-label font-semibold">{u.shopName}</p>
                    <p className="text-cap text-muted">
                      {u.categories.join(", ")}
                      {u.preferredSlot &&
                        (u.preferredSlot.state === "open" ? (
                          <> · prefers <span className="font-mono">{u.preferredSlot.label}</span></>
                        ) : (
                          <> · <span className="text-ink">{u.preferredSlot.state === "taken" ? `Preferred ${u.preferredSlot.label} is taken` : `${u.preferredSlot.label} is no longer available`}</span></>
                        ))}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-11 md:h-9"
                    disabled={g.open === 0}
                    aria-label={canTakePreferred ? `Assign ${u.preferredSlot!.label} to ${u.shopName}` : `Assign slot to ${u.shopName}`}
                    onClick={() => setAssigning(u)}
                  >
                    {canTakePreferred ? <>Assign <span className="font-mono">{u.preferredSlot!.label}</span></> : "Assign slot"}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="slots-h" className="flex flex-col gap-3">
        <h2 id="slots-h" className="text-h3">Vendors with a slot</h2>
        {data.assignments.length === 0 ? (
          <p className="text-sm text-muted">No slots assigned yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-left text-cap text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Vendor and slot</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.assignments.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{a.shopName}</p>
                      <p className="text-cap text-muted">
                        <span className="font-mono">{a.slotLabel}</span> · <span className="tabular-nums">{formatPeso(a.amountDue)}</span>
                      </p>
                    </td>
                    <td className="px-4 py-3"><PaymentBadge assignment={a} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.status === "reserved" ? "Paid" : formatDeadline(a.deadlineAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
// slots, the preferred one selected when it's still open.
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
  const [slotId, setSlotId] = React.useState<string | null>(vendor.preferredSlot?.state === "open" ? vendor.preferredSlot.id : null)
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)
  const picked = open.find((s) => s.id === slotId) ?? null
  const others = vendor.preferredSlot ? (vendors.slots.find((s) => s.id === vendor.preferredSlot!.id)?.preferredBy ?? 1) - 1 : 0
  // When the dialog opened, so the time shown doesn't move while it is open.
  const [byHours] = React.useState(() => new Date(Date.now() + vendors.event.deadlineHours * 3_600_000).toISOString())

  async function confirm() {
    if (!picked) return
    setSending(true)
    setError(null)
    const res = await api.POST("/api/organizer/events/{id}/assignments", {
      params: { path: { id: eventId } },
      body: { applicationId: vendor.applicationId, slotId: picked.id },
    })
    setSending(false)
    if (!res.data) return setError((res.error as ErrorBody)?.message ?? "Something went wrong. Try again.")
    queryClient.setQueryData(vendorsKey(eventId), res.data)
    onAssigned(picked.label)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-label={`Assign slot to ${vendor.shopName}`}>
        <DialogHeader>
          <DialogTitle>{`Assign slot to ${vendor.shopName}`}</DialogTitle>
          <DialogDescription>{`${vendor.shopName} gets an email with the slot, amount, and how to pay.`}</DialogDescription>
        </DialogHeader>
        {vendor.preferredSlot?.state === "open" && (
          <Alert tone="info">{`Prefers ${vendor.preferredSlot.label}.${others > 0 ? ` ${others} other vendor${others > 1 ? "s prefer" : " prefers"} it too.` : ""}`}</Alert>
        )}
        {vendor.preferredSlot?.state === "taken" && <Alert tone="warning">{`Preferred slot taken: ${vendor.preferredSlot.label}`}</Alert>}
        {vendor.preferredSlot?.state === "removed" && <Alert tone="warning">{`Preferred slot ${vendor.preferredSlot.label} is no longer available`}</Alert>}
        <div role="radiogroup" aria-label="Open slots" className="flex max-h-72 flex-col gap-3 overflow-y-auto">
          {groupSlots(open).map((group) => (
            <div key={group.name} className="flex flex-col gap-2">
              <p className="text-label">
                {group.name}
                <span className="text-cap text-muted">{` · ${[group.slots[0].sizeLabel, group.slots[0].price != null ? formatPeso(group.slots[0].price) : null].filter(Boolean).join(" · ")}`}</span>
              </p>
              <div className="grid grid-cols-5 gap-2">
                {group.slots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={s.id === slotId}
                    aria-label={`${s.label}${s.preferredBy ? `, preferred by ${s.preferredBy}` : ""}`}
                    onClick={() => setSlotId(s.id)}
                    className={cn(
                      "relative grid h-12 place-items-center rounded-xs border-[1.5px] font-mono text-[12px] font-medium",
                      s.id === slotId ? tileClass.reserved : tileClass.open
                    )}
                  >
                    {s.label}
                    {s.preferredBy > 0 && (
                      <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-pill bg-brand text-[11px] text-on-brand">
                        {s.preferredBy}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-cap text-muted">Only open slots are shown.</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Amount due</dt>
          <dd className="tabular-nums">{picked?.price != null ? formatPeso(picked.price) : "Pick a slot"}</dd>
          <dt className="text-muted">Pay within</dt>
          <dd>{`${vendors.event.deadlineHours} hours, by ${formatDeadline(byHours)} at the latest`}</dd>
        </dl>
        {error && <Alert tone="danger">{error}</Alert>}
        <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!picked || sending} onClick={confirm}>
            {picked ? `Assign ${picked.label}` : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
