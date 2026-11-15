"use client"

import type { ApprovalStatus, MeResponse } from "@creavent/shared"
import type * as React from "react"

import { toShellUser, type ShellUser } from "@/lib/shell-user"
import { useApprovalQueue } from "@/components/admin/queries"
import { useWaitingCount } from "@/components/organizer-applications/queries"
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

// Shown (hidden) in the shell while the session loads.
const loadingUser: ShellUser = { name: "", initials: "", roles: [] }

// Side menu badges, keyed by menu link (sitemap §5).
function countsFor(me: MeResponse | undefined): Record<string, string | number> {
  const status = me?.roles.find((r) => r.role === "organizer")?.approvalStatus
  return status ? { "/organizer/approval": approvalLabels[status] } : {}
}

// The admin menu's Approvals count (sitemap §5).
function AdminShell({ me, children }: { me: MeResponse | undefined; children: React.ReactNode }) {
  const { data: queue } = useApprovalQueue(Boolean(me?.isAdmin))
  return (
    <AppShell area="admin" user={me ? toShellUser(me) : loadingUser} counts={queue?.length ? { "/admin/approvals": queue.length } : {}}>
      {children}
    </AppShell>
  )
}

// The organizer menu's Applications count: applications waiting for review.
function OrganizerShell({ me, children }: { me: MeResponse | undefined; children: React.ReactNode }) {
  const isOrganizer = Boolean(me?.roles.some((r) => r.role === "organizer"))
  const { data: waiting } = useWaitingCount(isOrganizer)
  const counts = { ...countsFor(me), ...(waiting ? { "/organizer/applications": waiting } : {}) }
  return (
    <AppShell area="organizer" user={me ? toShellUser(me) : loadingUser} counts={counts}>
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
        ) : area === "organizer" ? (
          <OrganizerShell me={me}>{children}</OrganizerShell>
        ) : (
          <AppShell area={area} user={me ? toShellUser(me) : loadingUser} counts={countsFor(me)}>
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
          <PublicHeader user={me ? toShellUser(me) : loadingUser} />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      )}
    </SessionGate>
  )
}
