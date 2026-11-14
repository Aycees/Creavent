"use client"

import type { EventStatus, EventType } from "@creavent/shared"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// The event type as radio chips (mockup OrgEventDetails). Real radios, so
// arrow keys move between them.
export function EventTypeChips({
  types,
  value,
  onChange,
  name,
}: {
  types: EventType[]
  value: string
  onChange: (id: string) => void
  name: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {types.map((t) => (
        <label
          key={t.id}
          className={cn(
            "inline-flex h-11 cursor-pointer items-center rounded-pill border border-border-strong bg-surface px-4 text-label text-ink has-checked:border-inverse has-checked:bg-inverse has-checked:text-on-inverse has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"
          )}
        >
          <input type="radio" name={name} value={t.id} checked={value === t.id} onChange={() => onChange(t.id)} className="sr-only" />
          {t.name}
        </label>
      ))}
    </div>
  )
}

export const statusLabels: Record<EventStatus, string> = {
  draft: "Draft",
  open_to_vendors: "Open to vendors",
  announced: "Announced",
  completed: "Completed",
  canceled: "Canceled",
}

const statusTones: Record<EventStatus, React.ComponentProps<typeof Badge>["tone"]> = {
  draft: "neutral",
  open_to_vendors: "info",
  announced: "success",
  completed: "neutral",
  canceled: "danger",
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge tone={statusTones[status]}>{statusLabels[status]}</Badge>
}

// A form section card, as in the mockup's `.panel`.
export function SetupPanel({ title, intro, children }: { title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  const id = React.useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-h3">
          {title}
        </h2>
        {intro && <p className="text-sm text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

// The save row under a tab: a status line and the tab's Save button. It
// sticks to the bottom of the screen so Save is always in reach, like the
// profile pages' save bar.
export function TabSaveBar({ label, saving, dirty, error }: { label: string; saving: boolean; dirty: boolean; error: string | null }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-border bg-surface px-4 pt-3 pb-4 shadow-up md:mx-0 md:flex-row md:items-center md:gap-3 md:rounded-lg md:border md:px-5 md:pb-3">
      <p role="status" className={cn("text-sm", error ? "text-danger-ink" : dirty ? "text-warning-ink" : "text-muted")}>
        {error ?? (dirty ? "Unsaved changes" : "All changes saved")}
      </p>
      <Button type="submit" disabled={saving} className="md:ml-auto md:px-7">
        {saving ? "Saving…" : label}
      </Button>
    </div>
  )
}
