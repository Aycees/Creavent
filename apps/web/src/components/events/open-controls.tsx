"use client"

import type { EventChecklist, EventSetup } from "@creavent/shared"
import { CheckCircleIcon, WarningIcon } from "@phosphor-icons/react"
import Link from "next/link"
import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { saveError, useSetupSaved } from "./queries"

type Step = { key: keyof EventChecklist; label: string; missing: string; action: string; tab: string }

// The five required steps (spec §3.1), each with the tab that fills it.
const steps: Step[] = [
  { key: "details", label: "Name, date, venue and cover", missing: "Dates, venue and a cover image", action: "Fill in details", tab: "details" },
  { key: "requirements", label: "Vendor requirements", missing: "At least one accepted category", action: "Add requirements", tab: "requirements" },
  { key: "policy", label: "Cancellation and withdrawal policy", missing: "Save your policy", action: "Write your policy", tab: "policy" },
  { key: "slots", label: "At least one slot", missing: "Add the slots vendors can get", action: "Add slots", tab: "slots" },
  { key: "payments", label: "Payment instructions", missing: "How vendors pay you: GCash, bank or QR", action: "Add payment details", tab: "payments" },
]

export const isReady = (c: EventChecklist) => steps.every((s) => c[s.key])

// "Before you open to vendors" (mockup OrgEventSetup aside).
export function Checklist({ checklist, onGo }: { checklist: EventChecklist; onGo: (tab: string) => void }) {
  const id = React.useId()
  const done = steps.filter((s) => checklist[s.key]).length
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-h3">
          Before you open to vendors
        </h2>
        <p className="text-sm text-muted">
          {done} of {steps.length} required steps done
        </p>
      </div>
      <ul className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-x-6">
        {steps.map((s) =>
          checklist[s.key] ? (
            <li key={s.key} className="flex items-center gap-2.5">
              <CheckCircleIcon aria-hidden="true" className="size-5 flex-none text-success" />
              <span className="text-sm">{s.label}</span>
            </li>
          ) : (
            <li key={s.key} className="flex items-start gap-2.5">
              <WarningIcon aria-hidden="true" className="mt-0.5 size-5 flex-none text-warning" />
              <div className="flex flex-col items-start gap-1">
                <p className="text-sm font-semibold">{s.label}</p>
                <p className="text-cap text-muted">{s.missing}</p>
                <Button type="button" variant="secondary" size="sm" className="mt-1" onClick={() => onGo(s.tab)}>
                  {s.action}
                </Button>
              </div>
            </li>
          )
        )}
      </ul>
      <p className="text-cap text-muted">The vendor floor plan is optional.</p>
    </section>
  )
}

// Open to vendors, with a confirmation. Disabled until every step is done and
// the organizer is approved (flow 2 edge case).
export function OpenButton({ setup }: { setup: EventSetup }) {
  const saved = useSetupSaved(setup.id)
  const [confirming, setConfirming] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const ready = isReady(setup.checklist)

  async function open() {
    setSaving(true)
    setError(null)
    const res = await api.POST("/api/organizer/events/{id}/open", { params: { path: { id: setup.id } } })
    setSaving(false)
    if (!res.data) return setError(saveError(res.error).message)
    saved(res.data)
    setConfirming(false)
    toast.success("Your event is open to vendors")
  }

  return (
    <div className="flex flex-col items-stretch gap-1 md:items-end">
      <Button type="button" variant="brand" disabled={!ready || !setup.organizerApproved} onClick={() => setConfirming(true)}>
        Open to vendors
      </Button>
      {!setup.organizerApproved && (
        <Link href="/organizer/approval" className="text-cap text-muted underline underline-offset-2">
          Get approved to open this event to vendors
        </Link>
      )}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open this event to vendors?</DialogTitle>
            <DialogDescription>
              Signed-in vendors can find it and apply. Shoppers can&apos;t see it until you announce it. Applications open now, and you can close them any
              time.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-help text-danger-ink">{error}</p>}
          <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
              Not yet
            </Button>
            <Button type="button" variant="brand" disabled={saving} onClick={open}>
              Open to vendors
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Close or reopen applications on an open event (spec §3.3).
export function ApplicationsPanel({ setup }: { setup: EventSetup }) {
  const saved = useSetupSaved(setup.id)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const open = setup.applicationsOpen

  async function toggle() {
    setSaving(true)
    setError(null)
    const res = await api.PUT("/api/organizer/events/{id}/applications", { params: { path: { id: setup.id } }, body: { open: !open } })
    setSaving(false)
    if (!res.data) return setError(saveError(res.error).message)
    saved(res.data)
    toast.success(open ? "Applications closed" : "Applications open")
  }

  return (
    <section aria-label="Applications" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:flex-row md:items-center md:p-5">
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-label font-semibold">{open ? "Applications are open" : "Applications are closed"}</p>
        <p className="text-sm text-muted">
          {setup.status === "open_to_vendors" ? "Vendors can find this event and apply. Shoppers can't see it yet." : "Vendors can find this event."}
          {!open && " New applications are turned off."}
        </p>
        {error && <p className="text-help text-danger-ink">{error}</p>}
      </div>
      <Button type="button" variant="secondary" disabled={saving} onClick={toggle}>
        {open ? "Close applications" : "Open applications"}
      </Button>
    </section>
  )
}
