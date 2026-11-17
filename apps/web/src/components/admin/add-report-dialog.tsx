"use client"

import { addEmailReportSchema, REPORT_REASON_LABELS, reportNumber, type ReportReason, type ReportTarget } from "@creavent/shared"
import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input, inputClass } from "@/components/ui/input"
import { Segmented, SegmentedItem } from "@/components/ui/segmented"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { reportsKey } from "./queries"
import { TargetPicker, type PickedTarget } from "./target-picker"

type Errors = Partial<Record<"reporterEmail" | "targetId" | "details", string>>

// Add a report that reached the support inbox (spec §2.2, mockup AdminAddReport).
export function AddReportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const [email, setEmail] = React.useState("")
  const [type, setType] = React.useState<ReportTarget>("event")
  const [target, setTarget] = React.useState<PickedTarget | null>(null)
  const [reason, setReason] = React.useState<ReportReason>("scam")
  const [details, setDetails] = React.useState("")
  const [errors, setErrors] = React.useState<Errors>({})
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  function reset() {
    setEmail("")
    setTarget(null)
    setDetails("")
    setErrors({})
    setError(null)
  }

  async function add() {
    const body = { reporterEmail: email, targetType: type, targetId: target?.id ?? "", reason, details }
    const parsed = addEmailReportSchema.safeParse(body)
    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors
        next[key] ??= key === "targetId" ? "Choose what the report is about" : issue.message
      }
      return setErrors(next)
    }
    setErrors({})
    setSaving(true)
    const res = await api.POST("/api/admin/reports", { body })
    setSaving(false)
    if (!res.data) return setError((res.error as { message?: string } | undefined)?.message ?? "Something went wrong. Try again.")
    toast.success(`Report ${reportNumber(res.data.number)} added`)
    await queryClient.invalidateQueries({ queryKey: reportsKey })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add a report from email</DialogTitle>
          <DialogDescription>For reports that reach the support inbox. It joins the same queue as the report button.</DialogDescription>
        </DialogHeader>
        <Field label="Sender's email" htmlFor="ar-email" error={errors.reporterEmail}>
          <Input id="ar-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div className="flex flex-col gap-2">
          <span id="ar-about" className="text-label font-semibold">
            About
          </span>
          <Segmented role="group" aria-labelledby="ar-about" className="self-start">
            <SegmentedItem type="button" active={type === "event"} onClick={() => (setType("event"), setTarget(null))}>
              An event
            </SegmentedItem>
            <SegmentedItem type="button" active={type === "user"} onClick={() => (setType("user"), setTarget(null))}>
              A user
            </SegmentedItem>
          </Segmented>
        </div>
        <Field
          label={type === "event" ? "Event" : "User"}
          htmlFor="ar-target"
          error={errors.targetId}
          help={target ? `Selected: ${target.name}` : type === "event" ? "Search by event or organizer name." : "Search by name, email, shop or organizer name."}
        >
          <TargetPicker key={type} id="ar-target" type={type} value={target} onChange={setTarget} />
        </Field>
        <Field label="Reason" htmlFor="ar-reason">
          <select id="ar-reason" className={cn(inputClass, "h-11")} value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
            {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((r) => (
              <option key={r} value={r}>
                {REPORT_REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="What they said" htmlFor="ar-details" error={errors.details} help="Paste the relevant part of the email.">
          <Textarea id="ar-details" value={details} onChange={(e) => setDetails(e.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="text-help text-danger-ink">
            {error}
          </p>
        )}
        <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={add}>
            Add report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
