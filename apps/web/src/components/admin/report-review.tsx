"use client"

import { REPORT_REASON_LABELS, reportNumber, resolveReportSchema, type ReportDetail, type ResolveReportInput, type RoleType } from "@creavent/shared"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChoiceCard } from "@/components/ui/choice-card"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { reportsKey, useReportDetail } from "./queries"
import { outcomeLabels } from "./reports-queue"

const when = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
const day = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" })

type Choice = { key: string; label: string; hint: string; input: (reason: string, note: string) => ResolveReportInput; button: string }

const roleWords: Record<RoleType, string> = { vendor: "vendor", organizer: "organizer" }

// The decisions this report allows (spec §2.2): dismiss, hide the event, or
// suspend a role (the organizer's for an event, any of a user's roles).
function choicesFor(d: ReportDetail): Choice[] {
  const n = d.reports.length
  const many = n === 1 ? "" : ` ${n} reports`
  const list: Choice[] = [
    {
      key: "dismiss",
      label: "Dismiss",
      hint: "Nothing breaks the rules. Nobody is told.",
      input: (_r, note) => ({ decision: "dismiss", note }),
      button: n === 1 ? "Dismiss report" : `Dismiss ${n} reports`,
    },
  ]
  if (d.target.type === "event") {
    if (!d.target.hidden) {
      list.push({
        key: "hide",
        label: "Hide the event",
        hint: 'It leaves listings and its link shows "Not found". The reason is emailed to the organizer. You can show it again later.',
        input: (reason, note) => ({ decision: "hide_event", reason, note }),
        button: `Hide event and resolve${many || " report"}`,
      })
    }
    if (d.target.organizer && !d.target.organizer.suspended) {
      list.push({
        key: "suspend-organizer",
        label: "Suspend the organizer role",
        hint: `${d.target.organizer.name} can't manage events and their organizer page is hidden. The reason shows in the app.`,
        input: (reason, note) => ({ decision: "suspend_role", role: "organizer", reason, note }),
        button: "Suspend and resolve",
      })
    }
  } else {
    for (const r of d.target.roles.filter((x) => !x.suspended)) {
      list.push({
        key: `suspend-${r.role}`,
        label: `Suspend the ${roleWords[r.role]} role`,
        hint:
          r.role === "vendor"
            ? "They can't apply or manage slots, and their vendor page is hidden. The reason shows in the app."
            : "They can't manage events or applications, and their organizer page is hidden. The reason shows in the app.",
        input: (reason, note) => ({ decision: "suspend_role", role: r.role, reason, note }),
        button: "Suspend and resolve",
      })
    }
  }
  return list
}

function Decision({ d }: { d: ReportDetail }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const choices = choicesFor(d)
  const [key, setKey] = React.useState(choices[0]!.key)
  const [reason, setReason] = React.useState("")
  const [note, setNote] = React.useState("")
  const [reasonError, setReasonError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const choice = choices.find((c) => c.key === key) ?? choices[0]!
  const needsReason = choice.key !== "dismiss"

  async function resolve() {
    const body = choice.input(reason, note)
    const parsed = resolveReportSchema.safeParse(body)
    if (!parsed.success) return setReasonError(parsed.error.issues[0]?.message ?? "Write the reason they will see")
    setReasonError(null)
    setError(null)
    setSaving(true)
    const res = await api.POST("/api/admin/reports/{id}/resolve", { params: { path: { id: d.id } }, body })
    setSaving(false)
    if (!res.data) {
      await queryClient.invalidateQueries({ queryKey: reportsKey })
      return setError((res.error as { message?: string } | undefined)?.message ?? "Something went wrong. Try again.")
    }
    toast.success(choice.key === "dismiss" ? "Reports dismissed" : "Done. The reports are resolved.")
    await queryClient.invalidateQueries({ queryKey: reportsKey })
    router.push("/admin/reports")
  }

  return (
    <section aria-labelledby="decision" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-5">
      <h2 id="decision" className="text-h3">
        {d.reports.length === 1 ? "Decision" : `Decision for all ${d.reports.length} reports`}
      </h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Decision</legend>
        {choices.map((c) => (
          <ChoiceCard key={c.key}>
            <input type="radio" name="decision" className="mt-0.5 size-5 accent-ink" checked={key === c.key} onChange={() => setKey(c.key)} />
            <span className="flex flex-col">
              <span className="text-label font-semibold">{c.label}</span>
              <span className="text-cap text-muted">{c.hint}</span>
            </span>
          </ChoiceCard>
        ))}
      </fieldset>
      {needsReason && (
        <Field
          label={
            <>
              Reason{" "}
              <span className="font-normal text-muted">{choice.key === "hide" ? "(emailed to the organizer)" : "(shown to them in the app)"}</span>
            </>
          }
          htmlFor="decision-reason"
          error={reasonError}
        >
          <Textarea id="decision-reason" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}
      <Field label="Note for the team" htmlFor="decision-note" optional help="Internal. What you checked and why you decided.">
        <Textarea id="decision-note" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && (
        <p role="alert" className="text-help text-danger-ink">
          {error}
        </p>
      )}
      {/* Phones: the decision button sits in a sticky bar (design brief §10). */}
      <div className="flex border-t border-border pt-4 max-md:sticky max-md:bottom-0 max-md:-mx-4 max-md:border-t max-md:bg-surface max-md:px-4 max-md:pb-4 md:justify-end">
        <Button type="button" variant={needsReason ? "danger" : "primary"} className="max-md:w-full" disabled={saving} onClick={resolve}>
          {choice.button}
        </Button>
      </div>
      <p className="text-cap text-muted">Every decision is saved in the audit log. The people who reported aren&apos;t emailed.</p>
    </section>
  )
}

// /admin/reports/[id]: what each person said, and one decision for the group
// (sitemap §6, flow 11, mockup AdminReportDetail).
export function ReportReview({ reportId }: { reportId: string }) {
  const { data: d, isError } = useReportDetail(reportId)

  if (isError) return <Alert tone="danger">We couldn&apos;t load this report.</Alert>
  if (!d) return <p role="status" className="text-sm text-muted">Loading…</p>

  const t = d.target
  return (
    <div className="flex max-w-[880px] flex-col gap-6">
      <Link href="/admin/reports" className="inline-flex h-11 items-center gap-1.5 self-start text-sm text-muted">
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        Reports
      </Link>
      <div className="-mt-4 flex flex-col gap-1">
        <p className="text-cap text-muted">
          {t.type === "event" ? "Event report" : "User report"} · <span className="font-mono">{d.reports.map((r) => reportNumber(r.number)).join(", ")}</span>
        </p>
        <h1 className="text-h1">{t.name}</h1>
        <p className="text-sm text-muted">{t.subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {t.type === "event" ? (
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/admin/events/${t.id}`}>Open event</Link>
            </Button>
            {t.organizer && (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/admin/users/${t.organizer.userId}`}>Open organizer</Link>
              </Button>
            )}
          </>
        ) : (
          <Button asChild variant="secondary" size="sm">
            <Link href={`/admin/users/${t.id}`}>Open user</Link>
          </Button>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-h3">What people said</h2>
        {d.reports.map((r) => (
          <div key={r.number} className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge dot={false}>{REPORT_REASON_LABELS[r.reason]}</Badge>
              <span className="font-mono text-cap text-muted">{reportNumber(r.number)}</span>
            </div>
            {r.details && <p className="text-body">&ldquo;{r.details}&rdquo;</p>}
            <p className="text-cap text-muted">
              {r.reporter} · {r.source === "support_email" ? `support email${r.addedBy ? `, added by ${r.addedBy}` : ""}` : "report button"} ·{" "}
              {when.format(new Date(r.createdAt))}
            </p>
          </div>
        ))}
      </section>

      {d.status === "open" ? (
        <Decision d={d} />
      ) : (
        <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 md:p-5">
          <p className="text-label">
            <Badge tone={d.actionTaken === "none" ? "neutral" : "danger"}>{outcomeLabels[d.actionTaken ?? "other"]}</Badge>{" "}
            {d.resolvedByName && `by ${d.resolvedByName}`}
            {d.resolvedAt && ` on ${day.format(new Date(d.resolvedAt))}`}
          </p>
          {d.resolutionNote && <p className="text-sm text-muted">{d.resolutionNote}</p>}
          <p className="text-cap text-muted">Resolved reports are read only. To undo the outcome, show the event again or reinstate the role from its own page.</p>
        </section>
      )}
    </div>
  )
}
