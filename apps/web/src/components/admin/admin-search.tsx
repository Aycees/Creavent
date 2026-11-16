"use client"

import Link from "next/link"
import * as React from "react"

import { SearchInput } from "@/components/ui/search-input"
import { cn } from "@/lib/utils"
import { useDebounced } from "./parts"
import { useAdminSearch } from "./queries"

// The admin header search (sitemap §5): people and events, up to 5 each,
// drafts and hidden events included.
export function AdminSearch({ className }: { className?: string }) {
  const [q, setQ] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const term = useDebounced(q.trim(), 200)
  const { data } = useAdminSearch(term)
  const listId = React.useId()
  const showing = open && term.length > 0 && data !== undefined

  function close() {
    setOpen(false)
    setQ("")
  }

  return (
    <div
      className={cn("relative", className)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false)
      }}
    >
      <SearchInput
        role="combobox"
        aria-label="Search users and events"
        aria-expanded={showing}
        aria-controls={listId}
        placeholder="Search users, organizers, events"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => (setQ(e.target.value), setOpen(true))}
      />
      {showing && (
        <div id={listId} className="absolute top-13 right-0 left-0 z-40 flex max-h-[70vh] flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-lg max-md:fixed max-md:top-16 max-md:right-4 max-md:left-4">
          {data.people.length === 0 && data.events.length === 0 && <p className="px-3 py-2 text-sm text-muted">Nothing matches &ldquo;{term}&rdquo;.</p>}
          {data.people.length > 0 && <p className="px-3 pt-1.5 pb-1 text-cap font-semibold text-muted">People</p>}
          {data.people.map((p) => (
            <Link key={p.id} href={`/admin/users/${p.id}`} onClick={close} className="flex min-h-11 flex-col justify-center rounded-md px-3 py-1.5 text-ink no-underline hover:bg-sunken">
              <span className="text-label font-semibold">
                {p.name}
                {p.suspended && <span className="font-normal text-danger-ink"> · suspended</span>}
              </span>
              <span className="truncate text-cap text-muted">{`${p.subtitle} · ${p.email}`}</span>
            </Link>
          ))}
          {data.events.length > 0 && <p className="px-3 pt-2.5 pb-1 text-cap font-semibold text-muted">Events</p>}
          {data.events.map((e) => (
            <Link key={e.id} href={`/admin/events/${e.id}`} onClick={close} className="flex min-h-11 flex-col justify-center rounded-md px-3 py-1.5 text-ink no-underline hover:bg-sunken">
              <span className="text-label font-semibold">{e.name}</span>
              <span className="truncate text-cap text-muted">{e.subtitle}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
