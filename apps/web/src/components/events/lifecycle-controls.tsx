"use client"

import type { EventSetup } from "@creavent/shared"
import { EnvelopeSimpleIcon, MapPinIcon, ReceiptIcon, SquaresFourIcon } from "@phosphor-icons/react"
import Link from "next/link"
import * as React from "react"
import { toast } from "sonner"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"

import { saveError, useSetupSaved } from "./queries"

type Unpaid = EventSetup["lineup"]["unpaid"][number]

const unpaidBadges: Record<Unpaid["state"], { label: string; tone: "warning" | "info" | "neutral" }> = {
  overdue: { label: "Overdue", tone: "warning" },
  proof_submitted: { label: "Proof submitted", tone: "info" },
  waiting: { label: "Waiting for payment", tone: "neutral" },
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// Announce event (flow 8, decision Q7): on an event open to vendors that
// hasn't ended. Warns about slots that aren't paid yet (mockup OrgAnnounce).
export function AnnounceButton({ setup }: { setup: EventSetup }) {
  const saved = useSetupSaved(setup.id)
  const [confirming, setConfirming] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  if (setup.status !== "open_to_vendors" || setup.ended) return null
  const { confirmedVendors, unpaid } = setup.lineup
  const name = setup.details.name

  async function announce() {
    setSaving(true)
    setError(null)
    const res = await api.POST("/api/organizer/events/{id}/announce", { params: { path: { id: setup.id } } })
    setSaving(false)
    if (!res.data) return setError(saveError(res.error).message)
    saved(res.data)
    setConfirming(false)
    toast.success(`${name} is announced. It's on the event listing now.`)
  }

  return (
    <>
      <Button type="button" variant="brand" disabled={!setup.organizerApproved} onClick={() => setConfirming(true)}>
        Announce event
      </Button>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="md:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{`Announce ${name}?`}</DialogTitle>
            <DialogDescription>
              It goes on the Creavent event listing for everyone. The {plural(confirmedVendors, "vendor", "vendors")} with a confirmed slot show on the
              event page.
            </DialogDescription>
          </DialogHeader>
          {unpaid.length > 0 && (
            <div className="flex flex-col gap-2.5 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning-ink">
              <p>
                <span className="font-semibold">{`${plural(unpaid.length, "slot isn't", "slots aren't")} paid yet.`}</span> Those vendors stay off the
                event page until you approve their payment. You can keep confirming payments after you announce.
              </p>
              <ul className="overflow-hidden rounded-md bg-surface text-ink">
                {unpaid.map((u) => (
                  <li key={u.slotLabel} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0">
                    <span className="w-16 flex-none font-mono text-mono">{u.slotLabel}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{u.shopName}</span>
                    <Badge tone={unpaidBadges[u.state].tone}>{unpaidBadges[u.state].label}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!setup.slots.publicFloorPlan && (
            <p className="flex items-start gap-3 text-sm">
              <SquaresFourIcon aria-hidden="true" className="mt-0.5 size-5 flex-none text-muted" />
              <span>
                No public floor plan yet. It&apos;s optional, and you can add it after announcing.{" "}
                <Link href={`/organizer/events/${setup.id}?tab=public-floor-plan`} className="underline underline-offset-2">
                  Upload floor plan
                </Link>
              </span>
            </p>
          )}
          {error && <p className="text-help text-danger-ink">{error}</p>}
          <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
              Not yet
            </Button>
            <Button type="button" variant="brand" disabled={saving} onClick={announce}>
              Announce event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Cancel event (flow 9, decisions Q4, Q6, Q7): on an event open to vendors
// or announced. It can't be undone, so it is a quiet button with a firm
// confirm step (mockup OrgCancelPhone).
export function CancelEventButton({ setup }: { setup: EventSetup }) {
  const saved = useSetupSaved(setup.id)
  const [confirming, setConfirming] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const reasonId = React.useId()
  if (setup.status !== "open_to_vendors" && setup.status !== "announced") return null
  const name = setup.details.name

  async function cancel() {
    setSaving(true)
    setError(null)
    const res = await api.POST("/api/organizer/events/{id}/cancel", {
      params: { path: { id: setup.id } },
      body: { reason: reason.trim() || null },
    })
    setSaving(false)
    if (!res.data) return setError(saveError(res.error).message)
    saved(res.data)
    setConfirming(false)
    toast.success(`${name} is canceled. We're emailing your vendors.`)
  }

  return (
    <>
      <Button type="button" variant="danger-ghost" onClick={() => setConfirming(true)}>
        Cancel event
      </Button>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>{`Cancel ${name}?`}</DialogTitle>
            <DialogDescription>You can&apos;t undo this.</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-3 text-sm">
            <li className="flex items-start gap-3">
              <EnvelopeSimpleIcon aria-hidden="true" className="mt-0.5 size-5 flex-none text-muted" />
              <span>{`We email all ${plural(setup.lineup.activeVendors, "vendor who applied or has", "vendors who applied or have")} a slot.`}</span>
            </li>
            <li className="flex items-start gap-3">
              <MapPinIcon aria-hidden="true" className="mt-0.5 size-5 flex-none text-muted" />
              <span>The event leaves the listing. Its page stays up, marked canceled, so shared links still explain what happened.</span>
            </li>
            <li className="flex items-start gap-3">
              <ReceiptIcon aria-hidden="true" className="mt-0.5 size-5 flex-none text-muted" />
              <span>Refunds are between you and your vendors, under your event policy. Payment records stay available to both of you for 90 days.</span>
            </li>
          </ul>
          <Field label="Reason" htmlFor={reasonId} optional help="Vendors see it in the email and on the event page.">
            <Textarea id={reasonId} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {error && <p className="text-help text-danger-ink">{error}</p>}
          <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
              Keep event
            </Button>
            <Button type="button" variant="danger" disabled={saving} onClick={cancel}>
              Cancel event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

const canceledDay = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" })

// Shown at the top of a canceled event's setup (decision Q7).
export function CanceledNotice({ canceled }: { canceled: NonNullable<EventSetup["canceled"]> }) {
  return (
    <Alert tone="danger">
      <span className="flex flex-col gap-1">
        <span>
          <span className="font-semibold">This event is canceled.</span> You canceled it on {canceledDay.format(new Date(canceled.at))}. It can&apos;t be
          changed, and payment records stay readable for 90 days.
        </span>
        {canceled.reason && <span>{canceled.reason}</span>}
      </span>
    </Alert>
  )
}
