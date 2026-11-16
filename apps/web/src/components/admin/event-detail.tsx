"use client"

import { hideEventSchema, type AdminEvent } from "@creavent/shared"
import { ArrowLeftIcon, EyeIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import * as React from "react"
import { toast } from "sonner"

import { EventStatusBadge } from "@/components/events/parts"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { KeyValue } from "@/components/ui/key-value"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { adminDay, AdminPanel, History } from "./parts"
import { adminEventsKey, reportsKey, useAdminEvent } from "./queries"

function Moderation({ e }: { e: AdminEvent }) {
  const queryClient = useQueryClient()
  const [reason, setReason] = React.useState("")
  const [reasonError, setReasonError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  async function done(data: AdminEvent | undefined, err: unknown, message: string) {
    if (!data) return setError((err as { message?: string } | undefined)?.message ?? "Something went wrong. Try again.")
    queryClient.setQueryData([...adminEventsKey, e.id], data)
    await Promise.all([queryClient.invalidateQueries({ queryKey: adminEventsKey }), queryClient.invalidateQueries({ queryKey: reportsKey })])
    setReason("")
    toast.success(message)
  }

  async function hide() {
    const parsed = hideEventSchema.safeParse({ reason })
    if (!parsed.success) return setReasonError(parsed.error.issues[0]?.message ?? "Write the reason they will see")
    setReasonError(null)
    setSaving(true)
    const res = await api.POST("/api/admin/events/{id}/hide", { params: { path: { id: e.id } }, body: { reason } })
    setSaving(false)
    await done(res.data, res.error, `${e.name} is hidden. The organizer was emailed.`)
  }

  async function show() {
    setSaving(true)
    const res = await api.POST("/api/admin/events/{id}/show", { params: { path: { id: e.id } } })
    setSaving(false)
    await done(res.data, res.error, `${e.name} is visible again`)
  }

  if (e.hidden) {
    return (
      <AdminPanel title="Hidden by Creavent" danger>
        {e.moderationReason && <p className="text-sm">&ldquo;{e.moderationReason}&rdquo;</p>}
        <p className="text-cap text-muted">
          Hidden {e.moderatedAt && adminDay.format(new Date(e.moderatedAt))}
          {e.moderatedByName && ` by ${e.moderatedByName}`} · emailed to the organizer
        </p>
        <p className="text-sm text-muted">Creavent doesn&apos;t email vendors when an event is hidden. Email the vendors with a slot from the support inbox.</p>
        {error && (
          <p role="alert" className="text-help text-danger-ink">
            {error}
          </p>
        )}
        <Button type="button" variant="secondary" className="max-md:w-full md:self-start" disabled={saving} onClick={show}>
          Show event again
        </Button>
      </AdminPanel>
    )
  }
  return (
    <AdminPanel title="Hide this event" danger>
      <p className="text-sm text-muted">
        It leaves listings, the vendor browse page and search, and its link shows &ldquo;Not found&rdquo;. The organizer can&apos;t change it or
        its applications while it&apos;s hidden. Applications and slots stay as they are.
      </p>
      <Field
        label={
          <>
            Reason <span className="font-normal text-muted">(emailed to the organizer)</span>
          </>
        }
        htmlFor="hide-reason"
        error={reasonError}
      >
        <Textarea id="hide-reason" value={reason} maxLength={1000} onChange={(ev) => setReason(ev.target.value)} />
      </Field>
      {error && (
        <p role="alert" className="text-help text-danger-ink">
          {error}
        </p>
      )}
      <Button type="button" variant="danger" className="max-md:w-full md:self-start" disabled={saving} onClick={hide}>
        Hide event
      </Button>
    </AdminPanel>
  )
}

// /admin/events/[id]: the organizer, slots, applications with their files
// (each view is logged), reports, and hide or show (sitemap §6, mockup AdminEventDetail).
export function AdminEventDetail({ eventId }: { eventId: string }) {
  const { data: e, isError } = useAdminEvent(eventId)
  if (isError) return <Alert tone="danger">We couldn&apos;t load this event.</Alert>
  if (!e) return <p role="status" className="text-sm text-muted">Loading…</p>
  const publicPage = e.status === "announced" || e.status === "completed" || e.status === "canceled"

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/events" className="inline-flex h-11 items-center gap-1.5 self-start text-sm text-muted">
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        Events
      </Link>
      <div className="-mt-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-h1">{e.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <EventStatusBadge status={e.status} />
            {e.hidden && <Badge tone="danger">Hidden</Badge>}
          </div>
          <p className="text-sm text-muted">
            {[e.startsAt && adminDay.format(new Date(e.startsAt)), e.venueName, e.city].filter(Boolean).join(" · ")}
          </p>
        </div>
        {publicPage && !e.hidden && (
          <Button asChild variant="secondary">
            <Link href={`/events/${e.slug}`}>View public page</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start">
        <div className="flex flex-col gap-6">
          <AdminPanel title="Overview">
            <KeyValue
              items={[
                {
                  key: "Organizer",
                  value: (
                    <span>
                      <Link href={`/admin/users/${e.organizer.userId}`} className="underline underline-offset-2">
                        {e.organizer.name}
                      </Link>{" "}
                      · {e.organizer.fullName}
                      {e.organizer.suspended ? " · suspended" : e.organizer.approved ? " · approved" : " · not approved"}
                    </span>
                  ),
                },
                { key: "Slots", value: `${e.slots.total} · ${e.slots.reserved} reserved · ${e.slots.assigned} assigned` },
                { key: "Applications", value: String(e.applications.length) },
                {
                  key: "Reports",
                  value:
                    e.openReports.count && e.openReports.reportId ? (
                      <Link href={`/admin/reports/${e.openReports.reportId}`} className="underline underline-offset-2">
                        {e.openReports.count === 1 ? "1 open report" : `${e.openReports.count} open reports`}
                      </Link>
                    ) : (
                      "None open"
                    ),
                },
              ]}
            />
          </AdminPanel>
          <AdminPanel title="Applications">
            <Alert tone="info">
              <span>
                <EyeIcon aria-hidden="true" className="mr-1 inline size-4" />
                Opening a document or proof of payment is saved in the audit log, with your name.
              </span>
            </Alert>
            {e.applications.length === 0 ? (
              <p className="text-sm text-muted">No applications yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {e.applications.map((a) => (
                  <li key={a.id} className="flex flex-col gap-2 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <Link href={`/admin/users/${a.vendorUserId}`} className="font-semibold underline underline-offset-2">
                          {a.shopName}
                        </Link>
                        {a.slotLabels.length > 0 && <span className="text-cap text-muted">Slot {a.slotLabels.join(", ")}</span>}
                      </span>
                      <Badge>{a.status.replace("_", " ")}</Badge>
                    </div>
                    {(a.documents.length > 0 || a.proofs.length > 0) && (
                      <div className="flex flex-wrap gap-2">
                        {[...a.documents, ...a.proofs].map((f) => (
                          <Button key={f.fileId} asChild variant="secondary" size="sm">
                            <a href={`/api/files/${f.fileId}`} target="_blank" rel="noreferrer" aria-label={`View ${f.label} from ${a.shopName}`}>
                              {f.label}
                            </a>
                          </Button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>
        </div>
        <div className="flex flex-col gap-6">
          <Moderation e={e} />
          <History items={e.history} />
        </div>
      </div>
    </div>
  )
}
