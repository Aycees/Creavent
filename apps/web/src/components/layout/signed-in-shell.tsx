"use client"

import type { ApprovalStatus, MeResponse } from "@creavent/shared"
import type * as React from "react"

import { toShellUser } from "@/lib/shell-user"
import { useApprovalQueue } from "@/components/admin/queries"
import { AppShell } from "./app-shell"
import type { Area } from "./app-nav"
import { PublicHeader } from "./public-header"
import { SessionGate } from "./session-gate"
import { SiteFooter } from "./site-footer"

const approvalLabels: Record<ApprovalStatus, string> = {
  not_submitted: "Not submitted",
  pending_review: "Pending",
  approved: "Approved",
  rejected: "Rejected",
}

// Side menu badges, keyed by menu link (sitemap §5).
function countsFor(me: MeResponse): Record<string, string | number> {
  const status = me.roles.find((r) => r.role === "organizer")?.approvalStatus
  return status ? { "/organizer/approval": approvalLabels[status] } : {}
}

// The admin menu's Approvals count (sitemap §5).
function AdminShell({ me, children }: { me: MeResponse; children: React.ReactNode }) {
  const { data: queue } = useApprovalQueue()
  return (
    <AppShell area="admin" user={toShellUser(me)} counts={queue?.length ? { "/admin/approvals": queue.length } : {}}>
      {children}
    </AppShell>
  )
}

// The vendor, organizer, and admin areas: signed-in users with that role.
export function SignedInShell({ area, children }: { area: Area; children: React.ReactNode }) {
  return (
    <SessionGate area={area}>
      {(me) =>
        area === "admin" ? (
          <AdminShell me={me}>{children}</AdminShell>
        ) : (
          <AppShell area={area} user={toShellUser(me)} counts={countsFor(me)}>
            {children}
          </AppShell>
        )
      }
    </SessionGate>
  )
}

// Pages for any signed-in user: the public header with the account menu.
export function SignedInPage({ children }: { children: React.ReactNode }) {
  return (
    <SessionGate>
      {(me) => (
        <div className="flex min-h-dvh flex-col">
          <PublicHeader user={toShellUser(me)} />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      )}
    </SessionGate>
  )
}
