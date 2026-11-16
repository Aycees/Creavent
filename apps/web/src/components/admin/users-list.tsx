"use client"

import type { AdminUsers, AdminUsersFilter } from "@creavent/shared"
import Link from "next/link"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Badge, Tag } from "@/components/ui/badge"
import { Chip } from "@/components/ui/chip"
import { SearchInput } from "@/components/ui/search-input"
import { adminDay, Pager, useDebounced } from "./parts"
import { useAdminUsers } from "./queries"

const filters: { id: AdminUsersFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "vendors", label: "Vendors" },
  { id: "organizers", label: "Organizers" },
  { id: "suspended", label: "Suspended" },
]

const roleWord = { vendor: "Vendor", organizer: "Organizer" } as const

function roleTag(r: AdminUsers["items"][number]["roles"][number]) {
  const approval = r.role === "organizer" && r.approvalStatus && r.approvalStatus !== "approved" ? ` · ${r.approvalStatus === "pending_review" ? "pending" : r.approvalStatus.replace("_", " ")}` : ""
  return `${roleWord[r.role]}${r.name ? ` · ${r.name}` : ""}${approval}`
}

function Status({ u }: { u: AdminUsers["items"][number] }) {
  const suspended = u.roles.filter((r) => r.suspended)
  if (suspended.length) return <Badge tone="danger">{suspended.map((r) => `${roleWord[r.role]} suspended`).join(", ")}</Badge>
  if (u.openReports) return <Badge tone="warning">{u.openReports === 1 ? "1 open report" : `${u.openReports} open reports`}</Badge>
  return <Badge tone="success">Active</Badge>
}

// /admin/users: search by name, email or shop, filtered by role (sitemap §6, mockup AdminUsersP5).
export function AdminUsersList() {
  const [filter, setFilter] = React.useState<AdminUsersFilter>("all")
  const [q, setQ] = React.useState("")
  const [page, setPage] = React.useState(1)
  const term = useDebounced(q.trim())
  const { data, isError } = useAdminUsers({ ...(term ? { q: term } : {}), filter, page })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">Users</h1>
        {data && <p className="text-sm text-muted">{data.counts.all} accounts</p>}
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <SearchInput aria-label="Search users" placeholder="Name, email, shop or organizer name" className="md:w-96" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {filters.map((f) => (
            <Chip key={f.id} pressed={filter === f.id} count={data?.counts[f.id]} onClick={() => (setFilter(f.id), setPage(1))}>
              {f.label}
            </Chip>
          ))}
        </div>
      </div>
      {isError && <Alert tone="danger">We couldn&apos;t load users. Refresh to try again.</Alert>}
      {data?.items.length === 0 && <p className="rounded-lg border border-border bg-surface p-6 text-sm text-muted">No users match.</p>}
      {data && data.items.length > 0 && (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {data.items.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/users/${u.id}`} className="flex min-h-16 flex-col gap-2 px-4 py-3 no-underline hover:bg-sunken md:flex-row md:items-center md:gap-4">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-label font-semibold text-ink">{u.fullName}</span>
                  <span className="truncate text-cap text-muted">{u.email}</span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {u.roles.map((r) => (
                    <Tag key={r.role}>{roleTag(r)}</Tag>
                  ))}
                </span>
                <span className="text-cap text-muted md:w-28">Joined {adminDay.format(new Date(u.joinedAt))}</span>
                <span className="md:w-40 md:text-right">
                  <Status u={u} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
    </div>
  )
}
