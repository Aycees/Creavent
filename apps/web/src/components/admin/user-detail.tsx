"use client"

import { REPORT_REASON_LABELS, reportNumber, suspendRoleSchema, type AdminUser, type RoleType } from "@creavent/shared"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import * as React from "react"
import { toast } from "sonner"

import { EventStatusBadge } from "@/components/events/parts"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChoiceCard } from "@/components/ui/choice-card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { KeyValue } from "@/components/ui/key-value"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { adminDay, AdminPanel, History } from "./parts"
import { adminEventsKey, adminUsersKey, reportsKey, useAdminUser } from "./queries"

type Role = AdminUser["roles"][number]

const roleWord: Record<RoleType, string> = { vendor: "vendor", organizer: "organizer" }
const effects: Record<RoleType, string> = {
  vendor: "They can't apply or manage slots, and their vendor page is hidden. Organizers of events they joined aren't emailed.",
  organizer: "They can't manage events or applications, and their organizer page is hidden.",
}

function SuspendDialog({ user, role, open, onOpenChange }: { user: AdminUser; role: Role; open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient()
  const [reason, setReason] = React.useState("")
  const [hideEvents, setHideEvents] = React.useState(true)
  const [reasonError, setReasonError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const offerHide = role.role === "organizer" && role.upcomingEvents > 0

  async function suspend() {
    const body = { reason, ...(offerHide ? { hideUpcomingEvents: hideEvents } : {}) }
    const parsed = suspendRoleSchema.safeParse(body)
    if (!parsed.success) return setReasonError(parsed.error.issues[0]?.message ?? "Write the reason they will see")
    setReasonError(null)
    setSaving(true)
    const res = await api.POST("/api/admin/users/{id}/roles/{role}/suspend", { params: { path: { id: user.id, role: role.role } }, body })
    setSaving(false)
    if (!res.data) return setError((res.error as { message?: string } | undefined)?.message ?? "Something went wrong. Try again.")
    queryClient.setQueryData([...adminUsersKey, user.id], res.data)
    await Promise.all([queryClient.invalidateQueries({ queryKey: adminUsersKey }), queryClient.invalidateQueries({ queryKey: adminEventsKey }), queryClient.invalidateQueries({ queryKey: reportsKey })])
    toast.success(`${user.fullName}'s ${roleWord[role.role]} role is suspended`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{`Suspend ${user.fullName}'s ${roleWord[role.role]} role?`}</DialogTitle>
          <DialogDescription>{effects[role.role]} Their other roles keep working. You can reinstate this role later.</DialogDescription>
        </DialogHeader>
        <Field
          label={
            <>
              Reason <span className="font-normal text-muted">(shown to them in the app)</span>
            </>
          }
          htmlFor="suspend-reason"
          error={reasonError}
        >
          <Textarea id="suspend-reason" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {offerHide && (
          <ChoiceCard>
            <input type="checkbox" className="mt-0.5 size-5 accent-ink" checked={hideEvents} onChange={(e) => setHideEvents(e.target.checked)} />
            <span className="flex flex-col">
              <span className="text-label font-semibold">{`Also hide their ${role.upcomingEvents} upcoming ${role.upcomingEvents === 1 ? "event" : "events"}`}</span>
              <span className="text-cap text-muted">The same reason is emailed to them for each event. Email the vendors from the support inbox.</span>
            </span>
          </ChoiceCard>
        )}
        {error && (
          <p role="alert" className="text-help text-danger-ink">
            {error}
          </p>
        )}
        <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="danger" disabled={saving} onClick={suspend}>
            {`Suspend ${roleWord[role.role]} role`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RoleCard({ user, role }: { user: AdminUser; role: Role }) {
  const queryClient = useQueryClient()
  const [suspending, setSuspending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const title = role.role === "vendor" ? "Vendor" : "Organizer"
  const page = role.slug ? (role.role === "vendor" ? `/vendors/${role.slug}` : `/organizers/${role.slug}`) : null

  async function reinstate() {
    setSaving(true)
    const res = await api.POST("/api/admin/users/{id}/roles/{role}/reinstate", { params: { path: { id: user.id, role: role.role } } })
    setSaving(false)
    if (!res.data) return setError((res.error as { message?: string } | undefined)?.message ?? "Something went wrong. Try again.")
    queryClient.setQueryData([...adminUsersKey, user.id], res.data)
    await queryClient.invalidateQueries({ queryKey: adminUsersKey })
    toast.success(`${user.fullName}'s ${roleWord[role.role]} role is reinstated`)
  }

  return (
    <div className={`flex flex-col gap-2.5 rounded-lg border p-4 ${role.suspended ? "border-danger" : "border-border"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {title}
          {role.name && (
            <>
              {" · "}
              {page ? (
                <Link href={page} className="underline underline-offset-2">
                  {role.name}
                </Link>
              ) : (
                role.name
              )}
            </>
          )}
        </p>
        <Badge tone={role.suspended ? "danger" : "success"}>{role.suspended ? "Suspended" : "Active"}</Badge>
      </div>
      {role.role === "organizer" && role.approvalStatus && (
        <p className="text-sm text-muted">
          {role.approvalStatus === "approved" ? "Approved" : role.approvalStatus === "pending_review" ? "Waiting for review" : role.approvalStatus === "rejected" ? "Rejected" : "Not submitted for review"}
          {role.reviewedAt && role.approvalStatus !== "pending_review" && ` ${adminDay.format(new Date(role.reviewedAt))}`}
          {role.approvalStatus === "pending_review" && (
            <>
              {" · "}
              <Link href={`/admin/approvals/${user.id}`} className="underline underline-offset-2">
                Review
              </Link>
            </>
          )}
        </p>
      )}
      {role.suspended ? (
        <>
          {role.suspensionReason && <p className="text-sm">&ldquo;{role.suspensionReason}&rdquo;</p>}
          <p className="text-cap text-muted">
            Suspended {role.suspendedAt && adminDay.format(new Date(role.suspendedAt))}
            {role.suspendedByName && ` by ${role.suspendedByName}`}
          </p>
          <Button type="button" variant="secondary" className="max-md:w-full md:self-start" disabled={saving} onClick={reinstate}>
            {`Reinstate ${roleWord[role.role]} role`}
          </Button>
        </>
      ) : (
        <Button type="button" variant="danger-ghost" size="sm" className="self-start" onClick={() => setSuspending(true)}>
          {`Suspend ${roleWord[role.role]} role`}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-help text-danger-ink">
          {error}
        </p>
      )}
      <SuspendDialog key={String(suspending)} user={user} role={role} open={suspending} onOpenChange={setSuspending} />
    </div>
  )
}

// /admin/users/[id]: contact details, roles with suspend and reinstate,
// activity, reports and history (sitemap §6, mockup AdminUserDetail).
export function AdminUserDetail({ userId }: { userId: string }) {
  const { data: u, isError } = useAdminUser(userId)
  if (isError) return <Alert tone="danger">We couldn&apos;t load this user.</Alert>
  if (!u) return <p role="status" className="text-sm text-muted">Loading…</p>
  const openReports = u.reports.filter((r) => r.open)

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/users" className="inline-flex h-11 items-center gap-1.5 self-start text-sm text-muted">
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        Users
      </Link>
      <div className="-mt-4 flex flex-col gap-1">
        <h1 className="text-h1">{u.fullName}</h1>
        <p className="text-sm text-muted">Joined {adminDay.format(new Date(u.joinedAt))}</p>
      </div>
      {openReports.length > 0 && (
        <Alert tone="warning">
          {openReports.length === 1 ? "1 open report" : `${openReports.length} open reports`} about this user or their events.{" "}
          <Link href={`/admin/reports/${openReports[0]!.id}`} className="font-semibold text-inherit">
            Review
          </Link>
        </Alert>
      )}
      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start">
        <div className="flex flex-col gap-6">
          <AdminPanel title="Contact">
            <KeyValue
              items={[
                {
                  key: "Email",
                  value: (
                    <>
                      <span className="break-all">{u.email}</span> <span className="text-muted">{u.emailVerified ? "(confirmed)" : "(not confirmed)"}</span>
                    </>
                  ),
                },
                { key: "Mobile", value: u.phone ?? "Not given" },
                { key: "Last login", value: u.lastLoginAt ? adminDay.format(new Date(u.lastLoginAt)) : "Not recorded" },
              ]}
            />
          </AdminPanel>
          <AdminPanel title="Roles">
            {u.roles.map((r) => (
              <RoleCard key={r.role} user={u} role={r} />
            ))}
          </AdminPanel>
        </div>
        <div className="flex flex-col gap-6">
          {(u.events.length > 0 || u.applications.length > 0) && (
            <AdminPanel title="Activity">
              <ul className="flex flex-col divide-y divide-border">
                {u.events.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Link href={`/admin/events/${e.id}`} className="font-semibold underline underline-offset-2">
                        {e.name}
                      </Link>
                      <span className="text-cap text-muted">
                        Organizer · {e.applied} applied, {e.confirmed} confirmed
                      </span>
                    </span>
                    <EventStatusBadge status={e.status} />
                    {e.hidden && <Badge tone="danger">Hidden</Badge>}
                  </li>
                ))}
                {u.applications.map((a) => (
                  <li key={a.eventId} className="flex flex-wrap items-center gap-2 py-2.5">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Link href={`/admin/events/${a.eventId}`} className="font-semibold underline underline-offset-2">
                        {a.eventName}
                      </Link>
                      <span className="text-cap text-muted">Vendor{a.slotLabels.length ? ` · slot ${a.slotLabels.join(", ")}` : ""}</span>
                    </span>
                    <Badge>{a.status.replace("_", " ")}</Badge>
                  </li>
                ))}
              </ul>
            </AdminPanel>
          )}
          {u.reports.length > 0 && (
            <AdminPanel title="Reports">
              <ul className="flex flex-col gap-2">
                {u.reports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/reports/${r.id}`} className="text-sm underline underline-offset-2">
                      <span className="font-mono">{reportNumber(r.number)}</span> · {REPORT_REASON_LABELS[r.reason]} · {r.about}
                    </Link>{" "}
                    <span className="text-sm text-muted">{r.open ? "open" : "resolved"}</span>
                  </li>
                ))}
              </ul>
            </AdminPanel>
          )}
          <History items={u.history} />
        </div>
      </div>
    </div>
  )
}
