"use client"

import {
  formatPeso,
  groupSlots,
  MAX_SLOTS_PER_VENDOR,
  rowLabels,
  slotRowSchema,
  type EventSetup,
  type SlotInput,
  type SlotMode,
} from "@creavent/shared"
import { ArrowSquareOutIcon, PlusIcon, SquaresFourIcon, UploadSimpleIcon } from "@phosphor-icons/react"
import * as React from "react"
import { toast } from "sonner"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChoiceCard } from "@/components/ui/choice-card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input, inputClass } from "@/components/ui/input"
import { api } from "@/lib/api"
import { useUpload } from "@/lib/use-upload"
import { cn } from "@/lib/utils"
import { SetupPanel } from "./parts"
import { saveError, useSetupSaved } from "./queries"

type Slot = EventSetup["slots"]["list"][number]
type Result = { data?: EventSetup; error?: unknown }

// Runs one save and puts the answer in the cache. Returns the error message.
function useSetupAction(id: string) {
  const saved = useSetupSaved(id)
  return async (call: () => Promise<Result>, success?: string) => {
    const res = await call()
    if (!res.data) {
      const { message, details } = saveError(res.error)
      return details[0]?.message ?? message
    }
    saved(res.data)
    if (success) toast.success(success)
    return null
  }
}

// "1200" → 1200, "" → null. Anything else is sent as is for the API to refuse.
const toPrice = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[₱,\s]/g, "")))

// The Slots tab (spec §3.4, mockups OrgEventSetup and OrgEventSlotsPhone).
export function SlotsTab({ setup }: { setup: EventSetup }) {
  const run = useSetupAction(setup.id)
  const s = setup.slots
  const [editing, setEditing] = React.useState<Slot | "new" | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const path = { params: { path: { id: setup.id } } }

  async function saveSettings(
    change: Partial<{ mode: SlotMode; defaultPrice: number | null; vendorFloorPlanFileId: string | null; maxSlotsPerVendor: number }>,
    success?: string
  ) {
    setError(null)
    const body = { mode: s.mode, defaultPrice: s.defaultPrice, vendorFloorPlanFileId: s.vendorFloorPlan?.id ?? null, maxSlotsPerVendor: s.maxSlotsPerVendor, ...change }
    setError(await run(() => api.PUT("/api/organizer/events/{id}/slot-settings", { ...path, body }), success))
  }

  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_300px] md:items-start md:gap-8">
      <div className="order-2 flex flex-col gap-6 md:order-1">
        <SetupPanel title="How slots are filled" intro="You assign every slot either way. You can change this any time.">
          <div role="radiogroup" aria-label="How slots are filled" className="grid gap-3 md:grid-cols-2">
            <ModeOption
              mode="organizer_assigns"
              current={s.mode}
              title="I assign slots"
              text="Vendors apply without choosing. You pick a slot for each approved vendor."
              onPick={(mode) => saveSettings({ mode }, "Saved")}
            />
            <ModeOption
              mode="vendor_preference"
              current={s.mode}
              title="Vendors choose a preferred slot"
              text="Vendors pick an open slot when they apply. It isn't reserved. You see their pick when you assign."
              onPick={(mode) => saveSettings({ mode }, "Saved")}
            />
          </div>
          {s.mode === "vendor_preference" && !s.vendorFloorPlan && (
            <Alert tone="info">Upload your floor plan so vendors can see where each slot is when they pick one.</Alert>
          )}
        </SetupPanel>

        <SetupPanel title="Slots per vendor" intro="Vendors say how many they need when they apply, and pay for them together.">
          <select
            aria-label="Slots per vendor"
            className={cn(inputClass, "h-11 md:max-w-60")}
            value={s.maxSlotsPerVendor}
            onChange={(e) => saveSettings({ maxSlotsPerVendor: Number(e.target.value) }, "Saved")}
          >
            {Array.from({ length: MAX_SLOTS_PER_VENDOR }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "1 slot (default)" : `Up to ${n} slots`}
              </option>
            ))}
          </select>
        </SetupPanel>

        <AddRow setup={setup} run={run} />

        <SlotList setup={setup} onEdit={setEditing} onSaveDefault={(defaultPrice) => saveSettings({ defaultPrice }, "Default price saved")} />
        {error && <Alert tone="danger">{error}</Alert>}
      </div>

      <aside className="order-1 flex flex-col gap-4 md:order-2">
        <FloorPlanPanel
          title="Vendor floor plan"
          purpose="vendor_floor_plan"
          image={s.vendorFloorPlan}
          help="Keep it open while you add slots, and use the same numbers. Vendors see it on the event page and when they pick a preferred slot. We don't check that the numbers match."
          collapsible
          onChange={(fileId) => saveSettings({ vendorFloorPlanFileId: fileId }, "Floor plan saved")}
        />
      </aside>

      <SlotDialog setup={setup} slot={editing} run={run} onClose={() => setEditing(null)} />
    </div>
  )
}

function ModeOption({
  mode,
  current,
  title,
  text,
  onPick,
}: {
  mode: SlotMode
  current: SlotMode
  title: string
  text: string
  onPick: (mode: SlotMode) => void
}) {
  return (
    <ChoiceCard>
      <input type="radio" name="slotMode" className="mt-1 size-5 accent-ink" checked={current === mode} onChange={() => onPick(mode)} />
      <span className="flex flex-col gap-0.5">
        <span className="text-label font-semibold">{title}</span>
        <span className="text-sm text-muted">{text}</span>
      </span>
    </ChoiceCard>
  )
}

function AddRow({ setup, run }: { setup: EventSetup; run: ReturnType<typeof useSetupAction> }) {
  const empty = { section: "", prefix: "", from: "", to: "", sizeLabel: "", price: "" }
  const [row, setRow] = React.useState(empty)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const headingId = React.useId()
  const body = { ...row, price: toPrice(row.price) }
  const parsed = slotRowSchema.safeParse(body)
  const labels = parsed.success ? rowLabels(parsed.data) : []
  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setRow((r) => ({ ...r, [key]: e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the row")
    setError(null)
    setSaving(true)
    const message = await run(
      () => api.POST("/api/organizer/events/{id}/slots/row", { params: { path: { id: setup.id } }, body: parsed.data }),
      `Added ${labels.length} slots`
    )
    setSaving(false)
    if (message) setError(message)
    else setRow(empty)
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-h3">
          Add a row of slots
        </h2>
        <p className="text-sm text-muted">Number them the same way as your floor plan image. You can edit any slot after.</p>
      </div>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Field label="Section" optional htmlFor="row-section" className="col-span-2 md:col-span-1">
            <Input id="row-section" placeholder="Outdoor" value={row.section} onChange={set("section")} />
          </Field>
          <Field label="Prefix" htmlFor="row-prefix">
            <Input id="row-prefix" placeholder="C" value={row.prefix} onChange={set("prefix")} />
          </Field>
          <Field label="Size" htmlFor="row-size">
            <Input id="row-size" placeholder="3 × 3 m" value={row.sizeLabel} onChange={set("sizeLabel")} />
          </Field>
          <Field label="From" htmlFor="row-from">
            <Input id="row-from" inputMode="numeric" className="tabular-nums" placeholder="01" value={row.from} onChange={set("from")} />
          </Field>
          <Field label="To" htmlFor="row-to">
            <Input id="row-to" inputMode="numeric" className="tabular-nums" placeholder="06" value={row.to} onChange={set("to")} />
          </Field>
          <Field label="Price" optional htmlFor="row-price" className="col-span-2 md:col-span-1">
            <Input id="row-price" inputMode="decimal" className="tabular-nums" placeholder="Default price" value={row.price} onChange={set("price")} />
          </Field>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <Button type="submit" disabled={saving || labels.length === 0}>
            {labels.length ? `Add ${labels.length} ${labels.length === 1 ? "slot" : "slots"}` : "Add slots"}
          </Button>
          {labels.length > 0 && (
            <p className="text-sm text-muted">
              {`Adds ${labels[0]}${labels.length > 1 ? ` to ${labels[labels.length - 1]}` : ""}${row.section.trim() ? ` to ${row.section.trim()}` : ""}`}
            </p>
          )}
        </div>
        {error && <p className="text-help text-danger-ink">{error}</p>}
      </form>
    </section>
  )
}

function SlotList({ setup, onEdit, onSaveDefault }: { setup: EventSetup; onEdit: (slot: Slot | "new") => void; onSaveDefault: (price: number | null) => void }) {
  const s = setup.slots
  const groups = groupSlots(s.list)
  const [editingDefault, setEditingDefault] = React.useState(false)
  const [defaultPrice, setDefaultPrice] = React.useState(s.defaultPrice === null ? "" : String(s.defaultPrice))
  const price = (slot: Slot) => slot.price ?? s.defaultPrice

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3">
          {s.list.length} {s.list.length === 1 ? "slot" : "slots"}
        </h2>
        {editingDefault ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              onSaveDefault(toPrice(defaultPrice))
              setEditingDefault(false)
            }}
          >
            <Input aria-label="Default price" inputMode="decimal" className="w-28 tabular-nums" value={defaultPrice} onChange={(e) => setDefaultPrice(e.target.value)} />
            <Button type="submit">
              Save
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted">
            Default price {s.defaultPrice === null ? "not set" : formatPeso(s.defaultPrice)} ·{" "}
            <button type="button" className="inline-flex min-h-11 items-center text-ink underline underline-offset-2" onClick={() => setEditingDefault(true)}>
              change
            </button>
          </p>
        )}
      </div>

      {groups.map((g) => (
        <SlotGroup key={g.name} name={g.name} slots={g.slots} price={price} onEdit={onEdit} />
      ))}
      {s.list.length === 0 && <p className="rounded-lg border border-dashed border-border-strong p-6 text-center text-sm text-muted">No slots yet. Add a row, or one slot at a time.</p>}
      <p className="text-cap text-muted">Slots without a section are grouped by the letters before the number, for example C-01 to C-06.</p>
      <Button type="button" variant="secondary" className="self-start" onClick={() => onEdit("new")}>
        <PlusIcon aria-hidden="true" />
        Add a slot
      </Button>
    </section>
  )
}

function SlotGroup({ name, slots, price, onEdit }: { name: string; slots: Slot[]; price: (s: Slot) => number | null; onEdit: (s: Slot) => void }) {
  const id = React.useId()
  const [all, setAll] = React.useState(false)
  const range = slots.length > 1 ? `${slots[0].label} to ${slots[slots.length - 1].label}` : slots[0].label
  // Long runs collapse (design brief §10): the first few, then "13 more".
  const shown = all || slots.length <= 4 ? slots : slots.slice(0, 3)
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 bg-sunken px-4 py-3">
        <h3 id={id} className="text-label font-semibold">
          {name}
        </h3>
        <p className="text-cap text-muted">
          {range} · {slots.length} {slots.length === 1 ? "slot" : "slots"}
        </p>
      </div>
      <ul className="divide-y divide-border">
        {shown.map((slot) => {
          const p = price(slot)
          return (
            <li key={slot.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <span className="w-16 flex-none font-mono text-sm">{slot.label}</span>
              <span className="min-w-0 flex-1 text-sm text-muted">
                {slot.setAside && (
                  <Badge dot={false} className="mr-2">
                    Set aside
                  </Badge>
                )}
                {[slot.setAside?.note, slot.sizeLabel, slot.note].filter(Boolean).join(" · ")}
              </span>
              <span className={cn("text-sm tabular-nums", slot.price !== null && "font-semibold")}>{p === null ? "No price" : formatPeso(p)}</span>
              <Button type="button" variant="ghost" aria-label={`Edit ${slot.label}`} onClick={() => onEdit(slot)}>
                Edit
              </Button>
            </li>
          )
        })}
      </ul>
      {shown.length < slots.length && (
        <Button type="button" variant="ghost" className="w-full rounded-none border-t border-border" onClick={() => setAll(true)}>
          Show {slots.length - shown.length} more
        </Button>
      )}
    </section>
  )
}

function SlotDialog({ setup, slot, run, onClose }: { setup: EventSetup; slot: Slot | "new" | null; run: ReturnType<typeof useSetupAction>; onClose: () => void }) {
  return (
    <Dialog open={slot !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {slot !== null && <SlotForm key={slot === "new" ? "new" : slot.id} setup={setup} slot={slot === "new" ? null : slot} run={run} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function SlotForm({ setup, slot, run, onClose }: { setup: EventSetup; slot: Slot | null; run: ReturnType<typeof useSetupAction>; onClose: () => void }) {
  const [form, setForm] = React.useState({
    label: slot?.label ?? "",
    section: slot?.section ?? "",
    sizeLabel: slot?.sizeLabel ?? "",
    note: slot?.note ?? "",
    price: slot?.price === null || slot?.price === undefined ? "" : String(slot.price),
    setAside: slot?.setAside !== null && slot?.setAside !== undefined,
    setAsideNote: slot?.setAside?.note ?? "",
  })
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const path = { id: setup.id }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const body: SlotInput = {
      label: form.label.trim(),
      section: form.section.trim() || null,
      sizeLabel: form.sizeLabel.trim() || null,
      note: form.note.trim() || null,
      price: toPrice(form.price),
    }
    setSaving(true)
    let message = slot
      ? await run(() => api.PATCH("/api/organizer/events/{id}/slots/{slotId}", { params: { path: { ...path, slotId: slot.id } }, body }), "Slot saved")
      : await run(() => api.POST("/api/organizer/events/{id}/slots", { params: { path }, body }), "Slot added")
    // Set aside or opened again (decision P1), only when it changed.
    const note = form.setAside ? form.setAsideNote.trim() || null : null
    if (!message && slot && (form.setAside !== (slot.setAside !== null) || note !== (slot.setAside?.note ?? null))) {
      message = await run(() =>
        api.PUT("/api/organizer/events/{id}/slots/{slotId}/set-aside", { params: { path: { ...path, slotId: slot.id } }, body: { setAside: form.setAside, note } })
      )
    }
    setSaving(false)
    if (message) setError(message)
    else onClose()
  }

  async function remove() {
    if (!slot) return
    setSaving(true)
    const message = await run(() => api.DELETE("/api/organizer/events/{id}/slots/{slotId}", { params: { path: { ...path, slotId: slot.id } } }), "Slot removed")
    setSaving(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <form noValidate onSubmit={save} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{slot ? `Edit slot ${slot.label}` : "Add a slot"}</DialogTitle>
        <DialogDescription>Leave the price empty to use the default price.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Slot number" htmlFor="slot-label">
          <Input id="slot-label" value={form.label} onChange={set("label")} />
        </Field>
        <Field label="Price" optional htmlFor="slot-price">
          <Input id="slot-price" inputMode="decimal" className="tabular-nums" value={form.price} onChange={set("price")} />
        </Field>
        <Field label="Section" optional htmlFor="slot-section">
          <Input id="slot-section" value={form.section} onChange={set("section")} />
        </Field>
        <Field label="Size" optional htmlFor="slot-size">
          <Input id="slot-size" value={form.sizeLabel} onChange={set("sizeLabel")} />
        </Field>
        <Field label="Note" optional htmlFor="slot-note" className="col-span-2">
          <Input id="slot-note" placeholder="Near the entrance" value={form.note} onChange={set("note")} />
        </Field>
      </div>
      {slot && (
        <>
          <ChoiceCard>
            <input
              type="checkbox"
              className="mt-0.5 size-5 flex-none accent-ink"
              checked={form.setAside}
              onChange={(e) => setForm((f) => ({ ...f, setAside: e.target.checked }))}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-label font-semibold">Set aside this slot</span>
              <span className="text-sm text-muted">For your own booth, a sponsor, or another arrangement. Vendors see it as taken, and you can&apos;t assign it.</span>
            </span>
          </ChoiceCard>
          {form.setAside && (
            <Field label="What it's for" optional htmlFor="slot-aside-note" help="Only you see this.">
              <Input id="slot-aside-note" placeholder="Sponsor booth" value={form.setAsideNote} onChange={set("setAsideNote")} />
            </Field>
          )}
        </>
      )}
      {error && <p className="text-help text-danger-ink">{error}</p>}
      <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-between">
        {slot ? (
          <Button type="button" variant="danger-ghost" disabled={saving} onClick={remove}>
            Remove slot
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={saving}>
          Save slot
        </Button>
      </DialogFooter>
    </form>
  )
}

// A floor plan image with upload and replace. On phones the vendor floor plan
// sits behind "Show floor plan" (spec §3.4), and tapping it opens it full size.
export function FloorPlanPanel({
  title,
  purpose,
  image,
  help,
  collapsible = false,
  onChange,
}: {
  title: string
  purpose: "vendor_floor_plan" | "public_floor_plan"
  image: { id: string; url: string } | null
  help: string
  collapsible?: boolean
  onChange: (fileId: string | null) => Promise<void> | void
}) {
  const upload = useUpload(purpose)
  const input = React.useRef<HTMLInputElement>(null)
  const [open, setOpen] = React.useState(!collapsible)
  const label = purpose === "vendor_floor_plan" ? "floor plan" : "public floor plan"

  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-h3">{title}</h2>
        {collapsible && image && (
          <Button type="button" variant="ghost" className="md:hidden" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? "Hide floor plan" : "Show floor plan"}
          </Button>
        )}
      </div>
      {image ? (
        <a href={image.url} target="_blank" rel="noreferrer" className={cn("group relative block overflow-hidden rounded-md border border-border", !open && "hidden md:block")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
          <img src={image.url} alt={title} className="w-full object-contain" />
          <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-sm bg-surface/90 px-2 py-1 text-cap">
            <ArrowSquareOutIcon aria-hidden="true" className="size-4" />
            Open full size
          </span>
        </a>
      ) : (
        <div className="grid aspect-video place-items-center rounded-md border border-dashed border-border-strong bg-canvas text-muted md:aspect-[4/3]">
          <SquaresFourIcon aria-hidden="true" className="size-8" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={upload.pending} onClick={() => input.current?.click()}>
          <UploadSimpleIcon aria-hidden="true" className="size-4" />
          {upload.pending ? "Uploading…" : image ? "Replace" : `Upload ${label}`}
        </Button>
        {image && (
          <Button type="button" variant="danger-ghost" onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
      </div>
      <p className="text-cap text-muted">{help}</p>
      <p className="text-cap text-muted">JPEG, PNG or WebP, up to 10 MB.</p>
      {upload.error && <p className="text-help text-danger-ink">{upload.error}</p>}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={`${title} file`}
        className="sr-only"
        tabIndex={-1}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (!file) return
          const done = await upload.upload(file)
          if (done) await onChange(done.id)
        }}
      />
    </section>
  )
}
