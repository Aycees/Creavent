"use client"

import type { EventSetup } from "@creavent/shared"
import * as React from "react"
import { toast } from "sonner"

import { Alert } from "@/components/ui/alert"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { SetupPanel, TabSaveBar } from "./parts"
import { saveError, useSetupSaved } from "./queries"

// The Policy tab (spec §3.7, mockup OrgEventPolicy). A first event starts
// from the example, which counts for the checklist only once saved.
export function PolicyTab({ setup }: { setup: EventSetup }) {
  const saved = useSetupSaved(setup.id)
  const p = setup.policy
  const initial = p.text ?? p.example
  const [text, setText] = React.useState(initial)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const dirty = text !== initial || p.text === null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const res = await api.PUT("/api/organizer/events/{id}/policy", { params: { path: { id: setup.id } }, body: { text } })
    setSaving(false)
    if (!res.data) {
      const { message, details } = saveError(res.error)
      return setError(details[0]?.message ?? message)
    }
    saved(res.data)
    setText(res.data.policy.text ?? "")
    toast.success("Policy saved")
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_300px] md:items-start md:gap-8">
      <div className="flex flex-col gap-6">
        {p.copiedFrom ? (
          <Alert tone="info">
            <span>
              Copied from your last event, <strong className="font-semibold">{p.copiedFrom.name}</strong>. Edit it if this event is different. Changes
              here don&apos;t affect other events.
            </span>
          </Alert>
        ) : (
          p.text === null && <Alert tone="warning">This is an example. Edit this example and save it to finish this step.</Alert>
        )}
        <SetupPanel title="Cancellation and withdrawal policy" intro="Your own rules for payments, withdrawals, and refunds. Creavent doesn't set or enforce them.">
          <Field label="Policy" htmlFor="policy" help="Vendors read this before they apply. Applying means they accept it." error={error ?? undefined}>
            <Textarea id="policy" className="min-h-80 whitespace-pre-wrap" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
        </SetupPanel>
        <TabSaveBar label="Save policy" saving={saving} dirty={dirty} error={error ? "Check the policy" : null} />
      </div>
      <aside className="flex flex-col gap-2 rounded-lg bg-sunken p-4">
        <p className="text-label">Edits apply to new applications only</p>
        <p className="text-cap text-muted">Vendors who already applied keep the version they accepted.</p>
      </aside>
    </form>
  )
}
