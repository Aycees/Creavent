"use client"

import { rejectSchema, type ApprovalKind } from "@creavent/shared"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChoiceCard } from "@/components/ui/choice-card"
import { ExternalLink } from "@/components/ui/external-link"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { approvalHref, approvalQueueKey, useApprovalDetail } from "./queries"

const hostQuickReasons: Record<string, string> = {
  "Show shop activity": "Add a page that shows your products or a past stall, like posts or photos. Then resubmit and we'll review it again.",
  "Page too new": "Your page is very new. Add a page with a longer history, or posts of your products, and resubmit.",
  "Name doesn't match": "The shop name on your page doesn't match your shop name on Creavent. Update one so they match, then resubmit.",
}

const organizerQuickReasons: Record<string, string> = {
  "Add past events":
    "Add a page or post that shows your past events, like photos from a market you ran. Then resubmit and we'll review it again.",
  "Page too new": "Your page is very new. Add a page with a longer history, or posts from past events, and resubmit.",
  "Contact doesn't match":
    "The name or contact details on your page don't match what you gave us. Update them so they match, then resubmit.",
}

const day = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" })

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5">
      <h2 className="text-h3">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 md:flex-row md:gap-4">
      <dt className="text-cap text-muted md:w-28 md:flex-none">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  )
}

// /admin/approvals/[id]: the links to check, the organizer's profile and
// contact details, and the decision (sitemap §6, flow 11). With ?kind=host,
// a pop-up host request: the vendor profile, past events, and pop-ups
// instead (spec §4.7).
export function ApprovalReview({ userId, kind = "organizer" }: { userId: string; kind?: ApprovalKind }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: d, isError } = useApprovalDetail(userId, kind)
  const [outcome, setOutcome] = React.useState<"approve" | "reject">("approve")
  const [reason, setReason] = React.useState("")
  const [note, setNote] = React.useState("")
  const [reasonError, setReasonError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  if (isError) return <Alert tone="danger">We couldn&apos;t load this request.</Alert>
  if (!d) return <p role="status" className="text-sm text-muted">Loading…</p>

  const firstName = d.fullName.split(" ")[0]
  const days = d.businessDaysWaiting
  const host = d.host
  const quickReasons = host ? hostQuickReasons : organizerQuickReasons
  const nextHref = d.queue.nextUserId ? approvalHref(d.queue.nextUserId, d.queue.nextKind ?? "organizer") : null

  // What the admin is looking at, so the API can refuse a decision on a
  // request the organizer changed in the meantime.
  const seen = { displayName: d.displayName, socialLinks: d.socialLinks }

  async function decide() {
    if (!d) return
    setError(null)
    if (outcome === "reject") {
      const parsed = rejectSchema.pick({ reason: true }).safeParse({ reason })
      if (!parsed.success) return setReasonError(parsed.error.issues[0]?.message ?? "Tell them what to fix")
    }
    setReasonError(null)
    setSaving(true)
    const params = { params: { path: { userId } } }
    const res = host
      ? outcome === "approve"
        ? await api.POST("/api/admin/approvals/hosts/{userId}/approve", { ...params, body: { note, seen } })
        : await api.POST("/api/admin/approvals/hosts/{userId}/reject", { ...params, body: { reason, note, seen } })
      : outcome === "approve"
        ? await api.POST("/api/admin/approvals/{userId}/approve", { ...params, body: { note, seen } })
        : await api.POST("/api/admin/approvals/{userId}/reject", { ...params, body: { reason, note, seen } })
    setSaving(false)
    if (!res.data) {
      if (res.response.status === 409) await queryClient.invalidateQueries({ queryKey: approvalQueueKey })
      return setError((res.error as { message?: string } | undefined)?.message ?? "Something went wrong. Try again.")
    }
    toast.success(outcome === "approve" ? `${d.displayName} is approved` : `${d.displayName} was asked to resubmit`)
    await queryClient.invalidateQueries({ queryKey: approvalQueueKey })
    router.push(nextHref ?? "/admin/approvals")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/approvals" className="text-sm text-muted">
          Approvals
        </Link>
        {d.queue.position && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">
              {d.queue.position} of {d.queue.total} in queue
            </span>
            {nextHref && (
              <Button asChild variant="secondary" size="sm">
                <Link href={nextHref}>Next</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-h1">{d.displayName}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {host && (
            <Badge tone="info" dot={false}>
              Pop-up host
            </Badge>
          )}
          <Badge tone={d.status === "approved" ? "success" : d.status === "rejected" ? "danger" : "warning"}>
            {d.status === "pending_review" ? "Pending review" : d.status === "approved" ? "Approved" : d.status === "rejected" ? "Rejected" : "Not submitted"}
          </Badge>
          {d.submittedAt && (
            <span>
              Submitted {day.format(new Date(d.submittedAt))} · waiting {days} business {days === 1 ? "day" : "days"}
              {d.daysOverTarget > 0 && `, ${d.daysOverTarget} over target`}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_360px] md:items-start md:gap-6">
        <div className="flex flex-col gap-4">
          <Section title="Links to check">
            <p className="text-sm text-muted">
              {host
                ? "Look for real products or past stalls, recent activity, and the same shop name."
                : "Look for real past events, recent activity, and the same contact name."}{" "}
              Check the host on each link: an External site isn&apos;t a known social site.
            </p>
            <ul aria-label="Links to check" className="flex flex-col gap-2">
              {d.socialLinks.map((link) => (
                <li key={link} className="flex flex-col gap-1">
                  {d.newLinks.includes(link) && (
                    <Badge tone="warning" className="self-start">
                      New
                    </Badge>
                  )}
                  <ExternalLink link={link} />
                </li>
              ))}
            </ul>
          </Section>
          {host ? (
            <Section title="Vendor profile">
              <dl className="flex flex-col gap-2">
                {d.about && <Row label="About">{d.about}</Row>}
                <Row label="Sells">{[host.categories.join(", "), host.products].filter(Boolean).join(" · ") || "Not given"}</Row>
                <Row label="City">{d.city ?? "Not given"}</Row>
                {d.slug && <Row label="Page">/vendors/{d.slug}</Row>}
                <Row label="Past events">{host.eventsSoldAt === 0 ? "None yet" : `Sold at ${host.eventsSoldAt} Creavent ${host.eventsSoldAt === 1 ? "event" : "events"}`}</Row>
                <Row label="Pop-ups">
                  {host.popups.length === 0
                    ? "None yet"
                    : host.popups.map((p) => `${p.name} (${p.status}${p.startsAt ? `, ${day.format(new Date(p.startsAt))}` : ""})`).join("; ")}
                </Row>
              </dl>
              {host.photos.length > 0 && (
                <ul aria-label="Photos" className="grid grid-cols-4 gap-2">
                  {host.photos.map((url) => (
                    <li key={url}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
                      <img src={url} alt="" className="aspect-square w-full rounded-md object-cover" />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          ) : (
            <Section title="Organizer profile">
              <dl className="flex flex-col gap-2">
                {d.about && <Row label="About">{d.about}</Row>}
                <Row label="City">{d.city ?? "Not given"}</Row>
                {d.slug && <Row label="Page">/organizers/{d.slug}</Row>}
              </dl>
            </Section>
          )}
          <Section title="Contact">
            <dl className="flex flex-col gap-2">
              <Row label="Name">{d.fullName}</Row>
              <Row label="Mobile">{d.phone ?? "Not given"}</Row>
              {!host && <Row label="Contact email">{d.contactEmail ?? "Not given"}</Row>}
              <Row label="Login email">{d.loginEmail}</Row>
            </dl>
          </Section>
          <Section title="Account">
            <p className="text-sm">
              Created {day.format(new Date(d.accountCreatedAt))}
              {host
                ? d.roles.includes("organizer")
                  ? " · also an organizer"
                  : " · vendor only"
                : d.roles.includes("vendor") && " · also a vendor"}
            </p>
          </Section>
        </div>

        <Section title="Decision">
          {d.status !== "pending_review" ? (
            <div className="flex flex-col gap-2 text-sm">
              <p>
                {d.status === "approved" ? "Approved" : d.status === "rejected" ? "Rejected" : "Not submitted for review"}
                {d.reviewedAt && ` on ${day.format(new Date(d.reviewedAt))}`}.
              </p>
              {d.rejectionReason && <p className="text-muted">Reason: {d.rejectionReason}</p>}
              {d.adminNotes && <p className="text-muted">Internal note: {d.adminNotes}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-label">Outcome</legend>
                <ChoiceCard>
                  <input type="radio" name="outcome" className="mt-0.5 size-5 accent-ink" checked={outcome === "approve"} onChange={() => setOutcome("approve")} />
                  <span className="flex flex-col">
                    <span className="text-label font-semibold">{host ? "Approve to host pop-ups" : "Approve"}</span>
                    <span className="text-cap text-muted">
                      {host ? <>Their pop-ups show &quot;Approved by Creavent&quot;</> : <>Shows the &quot;Approved by Creavent&quot; badge</>}
                    </span>
                  </span>
                </ChoiceCard>
                <ChoiceCard>
                  <input type="radio" name="outcome" className="mt-0.5 size-5 accent-ink" checked={outcome === "reject"} onChange={() => setOutcome("reject")} />
                  <span className="flex flex-col">
                    <span className="text-label font-semibold">Reject with a reason</span>
                    <span className="text-cap text-muted">They can fix it and resubmit</span>
                  </span>
                </ChoiceCard>
              </fieldset>
              {outcome === "reject" && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(quickReasons).map(([label, text]) => (
                      <Button key={label} type="button" variant="secondary" size="sm" onClick={() => setReason(text)}>
                        {label}
                      </Button>
                    ))}
                  </div>
                  <Field label="Reason they'll see" htmlFor="reason" error={reasonError ?? undefined}>
                    <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!reasonError} />
                  </Field>
                </div>
              )}
              <Field label="Internal note" optional htmlFor="note" help="Only admins see this.">
                <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              {error && <Alert tone="danger">{error}</Alert>}
              <Button
                type="button"
                variant={outcome === "approve" ? "primary" : "danger"}
                block
                disabled={saving}
                onClick={decide}
              >
                {outcome === "approve" ? `Approve ${d.displayName}` : `Reject and email ${firstName}`}
              </Button>
              <p className="text-cap text-muted">
                {outcome === "approve"
                  ? host
                    ? `${firstName} gets an email and can announce pop-ups right away.`
                    : `${firstName} gets an email, and they can open events to vendors right away.`
                  : `${firstName} gets an email with the reason and can resubmit.`}
              </p>
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
