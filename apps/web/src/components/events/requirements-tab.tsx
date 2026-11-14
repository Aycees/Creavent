"use client"

import type { EventRequirementsInput, EventSetup } from "@creavent/shared"
import { PlusIcon } from "@phosphor-icons/react"
import * as React from "react"
import { toast } from "sonner"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input, inputClass } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { SetupPanel, TabSaveBar } from "./parts"
import { saveError, useSetupSaved } from "./queries"

type Doc = { id?: string; name: string; categoryId: string | null }

// The Requirements tab (spec §3.2, mockup OrgEventRequirements).
export function RequirementsTab({ setup }: { setup: EventSetup }) {
  const saved = useSetupSaved(setup.id)
  const initial = React.useMemo(() => fromSetup(setup), [setup])
  const [limits, setLimits] = React.useState(initial.limits)
  const [docs, setDocs] = React.useState<Doc[]>(initial.docs)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const accepted = setup.categories.filter((c) => c.id in limits)
  const dirty = JSON.stringify({ limits, docs }) !== JSON.stringify(initial)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const body: EventRequirementsInput = {
      categories: accepted.map((c) => ({ categoryId: c.id, maxVendors: limits[c.id] ? Number(limits[c.id]) : null })),
      documents: docs.map((d) => ({ ...(d.id ? { id: d.id } : {}), name: d.name, description: null, categoryId: d.categoryId })),
    }
    setSaving(true)
    const res = await api.PUT("/api/organizer/events/{id}/requirements", { params: { path: { id: setup.id } }, body })
    setSaving(false)
    if (!res.data) {
      const { message, details } = saveError(res.error)
      return setError(details[0]?.message ?? message)
    }
    saved(res.data)
    const next = fromSetup(res.data)
    setLimits(next.limits)
    setDocs(next.docs)
    toast.success("Requirements saved")
  }

  function toggle(id: string, on: boolean) {
    setLimits((m) => {
      const next = { ...m }
      if (on) next[id] = ""
      else delete next[id]
      return next
    })
    // A document for a category that is no longer accepted goes to everyone.
    if (!on) setDocs((list) => list.map((d) => (d.categoryId === id ? { ...d, categoryId: null } : d)))
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_300px] md:items-start md:gap-8">
      <div className="flex flex-col gap-6">
        <SetupPanel
          title="Accepted categories"
          intro='Pick at least one. A limit is a guide for you when reviewing ("Food: 4 of 6 accepted"). Nobody is rejected automatically.'
        >
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {setup.categories.map((c) => {
              const on = c.id in limits
              const box = `cat-${c.id}`
              return (
                <li key={c.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
                  <Checkbox id={box} checked={on} onCheckedChange={(v) => toggle(c.id, v === true)} />
                  <Label htmlFor={box} className="flex-1">
                    {c.name}
                  </Label>
                  {on ? (
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      aria-label={`Limit for ${c.name}`}
                      placeholder="No limit"
                      className="w-28 tabular-nums"
                      value={limits[c.id]}
                      onChange={(e) => setLimits((m) => ({ ...m, [c.id]: e.target.value }))}
                    />
                  ) : (
                    <span className="text-sm text-muted">Not accepted</span>
                  )}
                </li>
              )
            })}
          </ul>
        </SetupPanel>

        <SetupPanel
          title="Documents vendors upload when applying"
          intro="You review them before approving. Only you, the vendor, and Creavent admins can open them. They're deleted 90 days after the event."
        >
          {docs.length > 0 && (
            <ul className="flex flex-col gap-4">
              {docs.map((d, i) => {
                const n = i + 1
                return (
                  <li key={d.id ?? `new-${i}`} className="flex flex-col gap-3 rounded-md border border-border p-3 md:flex-row md:items-end">
                    <div className="flex flex-1 flex-col gap-2">
                      <Label htmlFor={`doc-${i}`}>Document {n}</Label>
                      <Input
                        id={`doc-${i}`}
                        aria-label={`Document ${n}`}
                        placeholder="Barangay business clearance"
                        value={d.name}
                        onChange={(e) => setDocs((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                      />
                    </div>
                    <div className="flex flex-col gap-2 md:w-56">
                      <Label htmlFor={`doc-who-${i}`}>Who uploads it</Label>
                      <select
                        id={`doc-who-${i}`}
                        aria-label={`Who uploads document ${n}`}
                        className={cn(inputClass, "h-11")}
                        value={d.categoryId ?? ""}
                        onChange={(e) => setDocs((list) => list.map((x, j) => (j === i ? { ...x, categoryId: e.target.value || null } : x)))}
                      >
                        <option value="">Every vendor</option>
                        {accepted.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} only
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="button"
                      variant="danger-ghost"
                      aria-label={`Remove document ${n}`}
                      onClick={() => setDocs((list) => list.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          <Button type="button" variant="secondary" className="self-start" onClick={() => setDocs((list) => [...list, { name: "", categoryId: null }])}>
            <PlusIcon aria-hidden="true" />
            Add a document
          </Button>
        </SetupPanel>

        <Alert tone="info">Shown to signed-in vendors only. Visitors never see requirements.</Alert>
        <TabSaveBar label="Save requirements" saving={saving} dirty={dirty} error={error} />
      </div>

      <aside className="flex flex-col gap-2 rounded-lg bg-sunken p-4">
        <p className="text-label">What vendors see</p>
        <p className="text-sm">&quot;Your category, Preloved clothing, is accepted. 5 of 12 spots for this category are left.&quot;</p>
        <p className="text-cap text-muted">Shown on the event page and in Browse events, worked out from the vendors you approve.</p>
      </aside>
    </form>
  )
}

function fromSetup(setup: EventSetup) {
  return {
    limits: Object.fromEntries(setup.requirements.categories.map((c) => [c.categoryId, c.maxVendors ? String(c.maxVendors) : ""])) as Record<
      string,
      string
    >,
    docs: setup.requirements.documents.map((d): Doc => ({ id: d.id, name: d.name, categoryId: d.categoryId })),
  }
}
