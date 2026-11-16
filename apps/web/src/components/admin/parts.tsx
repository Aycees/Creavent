"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"

export const adminDay = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" })

// A card section on the admin detail pages, as the mockup's `.panel`.
export function AdminPanel({ title, children, danger = false }: { title: string; children: React.ReactNode; danger?: boolean }) {
  const id = React.useId()
  return (
    <section aria-labelledby={id} className={`flex flex-col gap-3 rounded-lg border bg-surface p-4 md:p-5 ${danger ? "border-danger" : "border-border"}`}>
      <h2 id={id} className="text-h3">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function History({ items }: { items: { at: string; text: string }[] }) {
  return (
    <AdminPanel title="History">
      {items.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {items.map((h, i) => (
            <li key={i}>
              <span className="text-muted">{adminDay.format(new Date(h.at))} · </span>
              {h.text}
            </li>
          ))}
        </ul>
      )}
      <p className="text-cap text-muted">Admin decisions come from the audit log: approvals, suspensions, hidden events, reports and document views.</p>
    </AdminPanel>
  )
}

// "1 to 25 of 412" with Previous and Next.
export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  if (total <= pageSize) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted">
        {from} to {to} of {total}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={page === 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={to >= total} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}

// Search typed into a list waits a moment before it asks the API.
export function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}
