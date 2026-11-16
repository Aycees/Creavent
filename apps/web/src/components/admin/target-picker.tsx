"use client"

import type { ReportTarget } from "@creavent/shared"
import { CheckIcon } from "@phosphor-icons/react"
import * as React from "react"

import { SearchInput } from "@/components/ui/search-input"
import { cn } from "@/lib/utils"
import { useAdminSearch } from "./queries"

export type PickedTarget = { id: string; name: string; subtitle: string }

// Search for the event or user a support email is about (mockup AdminAddReport).
export function TargetPicker({
  type,
  value,
  onChange,
  id,
  describedBy,
}: {
  type: ReportTarget
  value: PickedTarget | null
  onChange: (t: PickedTarget | null) => void
  id: string
  describedBy?: string
}) {
  const [q, setQ] = React.useState("")
  const { data } = useAdminSearch(q)
  const options = type === "event" ? (data?.events ?? []) : (data?.people ?? [])

  return (
    <div className="flex flex-col gap-2">
      <SearchInput id={id} value={q} aria-describedby={describedBy} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      {q.trim() && (
        <ul role="listbox" aria-label={type === "event" ? "Matching events" : "Matching users"} className="overflow-hidden rounded-lg border border-border bg-surface">
          {options.length === 0 && <li className="px-4 py-3 text-sm text-muted">No matches.</li>}
          {options.map((o) => {
            const selected = value?.id === o.id
            return (
              <li
                key={o.id}
                role="option"
                aria-selected={selected}
                tabIndex={0}
                onClick={() => onChange({ id: o.id, name: o.name, subtitle: o.subtitle })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onChange({ id: o.id, name: o.name, subtitle: o.subtitle })
                  }
                }}
                className={cn("flex min-h-11 cursor-pointer items-center gap-3 border-b border-border px-4 py-2 last:border-b-0 hover:bg-sunken", selected && "bg-sunken")}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-label font-semibold">{o.name}</span>
                  <span className="truncate text-cap text-muted">{o.subtitle}</span>
                </span>
                {selected && <CheckIcon aria-hidden="true" className="size-5" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
