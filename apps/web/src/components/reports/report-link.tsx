"use client"

import { REPORT_REASON_LABELS, reportNumber, type ReportButtonTarget, type ReportReason } from "@creavent/shared"
import { CheckIcon } from "@phosphor-icons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ChoiceCard } from "@/components/ui/choice-card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { useMe } from "@/lib/queries"

const hints: Record<ReportReason, string | null> = {
  fake_account: "It isn't real, or it copies someone else",
  scam: "Asking for money in a way that seems wrong",
  inappropriate_content: "Offensive pictures or text",
  other: null,
}

type Noun = ReportButtonTarget

function EmailSupport({ noun, supportEmail }: { noun: Noun; supportEmail: string }) {
  return (
    <p className="text-sm text-muted">
      Something wrong with this {noun}? Email{noun === "event" ? " us at" : ""}{" "}
      <a href={`mailto:${supportEmail}`} className="text-ink underline underline-offset-2">
        {supportEmail}
      </a>{" "}
      and we&apos;ll look into it.
    </p>
  )
}

// The report button at the bottom of the event, organizer and vendor pages
// (spec §2.2, decided 2026-11-17). It names the event or the organizer or
// vendor page by its own id, never a user id. Signed-out visitors, and the
// page's owner, see the support email instead.
export function ReportLink({ targetType, targetId, supportEmail }: { targetType: ReportButtonTarget; targetId: string; supportEmail: string }) {
  const noun: Noun = targetType
  const { data: me } = useMe()
  const signedIn = !!me && !me.needsLegal
  const mineKey = ["reports", "mine", targetType, targetId]
  const queryClient = useQueryClient()
  const { data: status } = useQuery({
    queryKey: mineKey,
    enabled: signedIn,
    queryFn: async () => {
      const { data } = await api.GET("/api/reports/mine", { params: { query: { targetType, targetId } } })
      return data ?? { number: null, own: false }
    },
  })
  const mine = status?.number ?? null
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState<ReportReason | null>(null)
  const [details, setDetails] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)

  if (!signedIn || !status || status.own) return <EmailSupport noun={noun} supportEmail={supportEmail} />

  if (mine) {
    return (
      <p className="flex items-center gap-2.5 text-sm text-muted">
        <CheckIcon aria-hidden="true" className="size-5 flex-none" />
        <span>
          You reported this {noun}. Reference <span className="font-mono text-mono">{reportNumber(mine)}</span>.
        </span>
      </p>
    )
  }

  async function send() {
    if (!reason) return setError("Choose what's wrong")
    setError(null)
    setSending(true)
    const res = await api.POST("/api/reports", { body: { targetType, targetId, reason, details } })
    setSending(false)
    if (!res.data) return setError((res.error as { message?: string } | undefined)?.message ?? "Something went wrong. Try again.")
    queryClient.setQueryData(mineKey, { number: res.data.number, own: false })
    setOpen(false)
    toast.success(`Report sent. Your reference is ${reportNumber(res.data.number)}.`)
  }

  return (
    <>
      <div>
        <Button type="button" variant="ghost" className="-ml-3 text-muted" onClick={() => setOpen(true)}>
          Report this {noun}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="md:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Report this {noun}</DialogTitle>
            <DialogDescription>
              The Creavent team reviews every report. The {noun === "event" ? "organizer" : noun} isn&apos;t told who reported.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-label font-semibold">What&apos;s wrong?</legend>
            {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((r) => (
              <ChoiceCard key={r}>
                <input type="radio" name="reason" className="mt-0.5 size-5 accent-ink" checked={reason === r} onChange={() => setReason(r)} />
                <span className="flex flex-col">
                  <span className="text-label font-semibold">{REPORT_REASON_LABELS[r]}</span>
                  {hints[r] && <span className="text-cap text-muted">{hints[r]}</span>}
                </span>
              </ChoiceCard>
            ))}
          </fieldset>
          <Field label="What happened?" htmlFor="report-details" optional>
            <Textarea id="report-details" value={details} maxLength={2000} onChange={(e) => setDetails(e.target.value)} />
          </Field>
          {error && (
            <p role="alert" className="text-help text-danger-ink">
              {error}
            </p>
          )}
          <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={sending} onClick={send}>
              Send report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
