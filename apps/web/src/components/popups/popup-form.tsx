"use client"

import { eventCities, formatSchedule, formatTime, popupDetailsSchema, type Popup, type PopupChecklist, type PopupDetailsInput } from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarBlankIcon, CheckCircleIcon, CopySimpleIcon, DotsThreeIcon, GlobeSimpleIcon, TrashIcon, WarningIcon, XCircleIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { CoverField } from "@/components/events/cover-field"
import { EventStatusBadge, SetupPanel, TabSaveBar } from "@/components/events/parts"
import { saveError } from "@/components/events/queries"
import { CopyTextButton } from "@/components/public/copy-text-button"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateStamp } from "@/components/ui/date-stamp"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field } from "@/components/ui/field"
import { Input, inputClass } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { eventDays, stampDate } from "@/lib/event-format"
import { cn } from "@/lib/utils"
import { popupsKey, usePopup } from "./queries"

type Form = PopupDetailsInput

function defaults(p: Popup): Form {
  const d = p.details
  return {
    name: d.name,
    description: d.description ?? "",
    startDate: d.startDate ?? "",
    endDate: d.endDate ?? "",
    opensAt: d.opensAt ?? "",
    closesAt: d.closesAt ?? "",
    venueName: d.venueName ?? "",
    addressLine: d.addressLine ?? "",
    city: (d.city ?? "") as Form["city"],
    coverFileId: d.cover?.id ?? null,
  }
}

// Time pickers move in 5-minute steps (the step is in seconds).
const FIVE_MINUTES = 300
const fieldNames = Object.keys(popupDetailsSchema.shape) as (keyof Form)[]

// "Before you announce" (spec §4.7), in the mockup's order.
const steps: { key: keyof PopupChecklist; label: string }[] = [
  { key: "about", label: "Name and description" },
  { key: "schedule", label: "Dates and hours" },
  { key: "profile", label: "Shop name, mobile number and a category" },
  { key: "cover", label: "Cover image" },
  { key: "venue", label: "Venue name, address and city" },
  { key: "host", label: "Approved to host" },
]

const ready = (c: PopupChecklist) => steps.every((s) => c[s.key])

// After a change: every change answers with the whole pop-up.
function useSaved(id: string) {
  const queryClient = useQueryClient()
  return (p: Popup) => {
    queryClient.setQueryData([...popupsKey, id], p)
    void queryClient.invalidateQueries({ queryKey: popupsKey, exact: true })
    void queryClient.invalidateQueries({ queryKey: [...popupsKey, "summary"] })
  }
}

// /vendor/popups/[id]: one form, no tabs (spec §4.7, sitemap pop-up pages,
// mockups P6PopupForm and its states).
export function PopupEditor({ id }: { id: string }) {
  const { data: p, isError } = usePopup(id)
  if (isError) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-h1">Pop-up not found</h1>
        <p className="text-body text-muted">We couldn&apos;t find this pop-up.</p>
        <Button asChild variant="secondary">
          <Link href="/vendor/popups">Back to my pop-ups</Link>
        </Button>
      </div>
    )
  }
  if (!p) return <p role="status" className="text-sm text-muted">Loading…</p>
  return <Editor key={p.updatedAt} popup={p} />
}

function statusLine(p: Popup) {
  switch (p.status) {
    case "draft":
      return "Only you can see this draft."
    case "announced":
      return p.ended ? "This pop-up has ended." : "Announced, on the events page."
    case "completed":
      return "Completed. It counts on your vendor page."
    default:
      return null
  }
}

function Editor({ popup: p }: { popup: Popup }) {
  const saved = useSaved(p.id)
  const [covers, setCovers] = React.useState<Record<string, string>>(() => (p.details.cover ? { [p.details.cover.id]: p.details.cover.url } : {}))
  const [error, setError] = React.useState<string | null>(null)
  const { register, control, handleSubmit, reset, setValue, setError: setFieldError, formState } = useForm<Form>({
    resolver: zodResolver(popupDetailsSchema, undefined, { raw: true }),
    defaultValues: defaults(p),
  })
  const values = useWatch({ control }) as Form
  const locked = p.lock !== null
  const coverUrl = values.coverFileId ? (covers[values.coverFileId] ?? null) : null
  const schedule = { startDate: values.startDate || null, endDate: values.endDate || null, opensAt: values.opensAt || null, closesAt: values.closesAt || null }
  const preview = formatSchedule(schedule)
  const days = eventDays(schedule)
  const err = (name: keyof Form) => formState.errors[name]?.message
  const d = p.details
  const stampDays = eventDays(d)

  async function onSubmit(form: Form) {
    setError(null)
    // Blank fields as null, as the API stores them.
    const body = popupDetailsSchema.parse(form)
    const res = await api.PUT("/api/vendor/popups/{id}", { params: { path: { id: p.id } }, body })
    if (!res.data) {
      const { message, details } = saveError(res.error)
      const fields = details.filter((x) => fieldNames.includes(x.path as keyof Form))
      for (const x of fields) setFieldError(x.path as keyof Form, { message: x.message })
      return setError(fields.length ? "Check the highlighted fields" : message)
    }
    saved(res.data)
    reset(defaults(res.data))
    toast.success("Pop-up saved")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/vendor/popups">Pop-ups</Link> / <span>{d.name}</span>
        </nav>
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          {d.startDate && <DateStamp date={stampDate(d.startDate)} endDay={stampDays > 1 && d.endDate ? Number(d.endDate.slice(8)) : undefined} />}
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-h1">{d.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <EventStatusBadge status={p.status} />
              <Badge dot={false}>Pop-up</Badge>
              {p.hiddenByCreavent && <Badge tone="danger">Hidden</Badge>}
            </div>
            {!p.canceled && !p.hiddenByCreavent && statusLine(p) && <p className="text-sm text-muted">{statusLine(p)}</p>}
          </div>
        </div>
        {!p.hiddenByCreavent && p.lock !== "suspended" && (
          <div className="flex items-center gap-2">
            {p.status === "draft" && (
              <div className="flex-1 md:flex-none [&_a]:max-md:w-full [&_button]:max-md:w-full">
                {p.checklist.host ? (
                  <AnnounceButton popup={p} dirty={formState.isDirty} />
                ) : (
                  <Button asChild variant="brand">
                    <Link href="/vendor/host-approval">Get approved to announce</Link>
                  </Button>
                )}
              </div>
            )}
            <MoreActions popup={p} />
          </div>
        )}
      </div>

      <Notices popup={p} />

      {p.status === "announced" && !p.ended && !p.lock && <ShareBox popup={p} />}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_300px] md:items-start md:gap-8">
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-6">
          <SetupPanel title="About the pop-up">
            <Field label="Pop-up name" htmlFor="name" error={err("name")}>
              <Input id="name" aria-invalid={!!err("name")} {...register("name")} />
            </Field>
            <Field label="Description" htmlFor="description" error={err("description")} help="What you're selling and anything people should know.">
              <Textarea id="description" {...register("description")} />
            </Field>
            <CoverField
              url={coverUrl}
              alt="Pop-up cover"
              disabled={locked}
              onUploaded={(file) => {
                setCovers((m) => ({ ...m, [file.id]: file.url }))
                setValue("coverFileId", file.id, { shouldDirty: true })
              }}
              onRemove={() => setValue("coverFileId", null, { shouldDirty: true })}
            />
            <div className="flex flex-col gap-1 rounded-md bg-sunken px-4 py-3">
              <p className="text-label font-semibold">{`Shows your shop: ${p.shop.categories.join(", ") || "no categories yet"}`}</p>
              <p className="text-cap text-muted">
                Categories, photos and social links come from your profile.{" "}
                <Link href="/vendor/profile" className="text-ink underline underline-offset-2">
                  Edit profile
                </Link>
              </p>
            </div>
          </SetupPanel>

          <SetupPanel title="Dates and hours" intro="Up to 7 days in a row, with the same hours every day.">
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <Field label="Start date" htmlFor="startDate" error={err("startDate")}>
                <Input id="startDate" type="date" aria-invalid={!!err("startDate")} {...register("startDate")} />
              </Field>
              <Field label="End date" htmlFor="endDate" error={err("endDate")}>
                <Input id="endDate" type="date" aria-invalid={!!err("endDate")} {...register("endDate")} />
              </Field>
              <Field label="Opens" htmlFor="opensAt" error={err("opensAt")}>
                <Input id="opensAt" type="time" step={FIVE_MINUTES} aria-invalid={!!err("opensAt")} {...register("opensAt")} />
              </Field>
              <Field label="Closes" htmlFor="closesAt" error={err("closesAt")}>
                <Input id="closesAt" type="time" step={FIVE_MINUTES} aria-invalid={!!err("closesAt")} {...register("closesAt")} />
              </Field>
            </div>
            <div className="flex items-start gap-3 rounded-md bg-sunken px-4 py-3.5">
              <CalendarBlankIcon aria-hidden="true" className="mt-0.5 size-5 flex-none text-muted" />
              <div>
                <p className="text-label font-semibold">{preview && days > 0 && days <= 7 ? preview : "Pick the dates and hours"}</p>
                <p className="text-cap text-muted">
                  {preview && days > 0 && days <= 7 ? `Runs ${days} ${days === 1 ? "day" : "days"}. ` : ""}Closing time must be on the same day.
                </p>
              </div>
            </div>
          </SetupPanel>

          <SetupPanel title="Venue">
            <Field label="Venue name" htmlFor="venueName" error={err("venueName")}>
              <Input id="venueName" {...register("venueName")} />
            </Field>
            <Field label="Address" htmlFor="addressLine" error={err("addressLine")}>
              <Input id="addressLine" autoComplete="street-address" {...register("addressLine")} />
            </Field>
            <Field label="City" htmlFor="city" error={err("city")}>
              <select id="city" className={cn(inputClass, "h-11 md:max-w-80")} {...register("city")}>
                <option value="">Pick a city</option>
                {eventCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </SetupPanel>

          {!locked && <TabSaveBar label="Save" saving={formState.isSubmitting} dirty={formState.isDirty} error={error} />}
        </fieldset>

        <aside className="flex flex-col gap-4">
          {p.status === "draft" && <Checklist checklist={p.checklist} />}
          <div className="flex flex-col gap-1 rounded-lg bg-sunken p-4">
            <p className="text-label font-semibold">No preview needed</p>
            <p className="text-sm text-muted">Vendors and visitors see the same page, so there&apos;s no &quot;Preview as vendor&quot;.</p>
          </div>
        </aside>
      </form>
    </div>
  )
}

function Checklist({ checklist }: { checklist: PopupChecklist }) {
  const id = React.useId()
  const done = steps.filter((s) => checklist[s.key]).length
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-h3">
          Before you announce
        </h2>
        <span className="text-sm text-muted">{`${done} of ${steps.length} done`}</span>
      </div>
      <ul className="flex flex-col gap-3">
        {steps.map((s) => (
          <li key={s.key} className="flex items-start gap-2.5">
            {checklist[s.key] ? (
              <CheckCircleIcon aria-hidden="true" className="mt-0.5 size-5 flex-none text-success" />
            ) : (
              <WarningIcon aria-hidden="true" className="mt-0.5 size-5 flex-none text-warning" />
            )}
            <div className="flex flex-col items-start gap-1">
              <span className={cn("text-sm", !checklist[s.key] && "font-semibold")}>{s.label}</span>
              {!checklist[s.key] && s.key === "host" && (
                <>
                  <span className="text-cap text-muted">One time. We check your shop&apos;s social pages.</span>
                  <Button asChild variant="secondary" className="mt-1">
                    <Link href="/vendor/host-approval">Get approved</Link>
                  </Button>
                </>
              )}
              {!checklist[s.key] && s.key === "profile" && (
                <Link href="/vendor/profile" className="text-cap text-ink underline underline-offset-2">
                  Edit profile
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Notices({ popup: p }: { popup: Popup }) {
  if (p.hiddenByCreavent) {
    return (
      <Alert tone="danger">
        <span className="flex flex-col gap-1">
          <span className="font-semibold">Hidden by Creavent</span>
          {p.hiddenByCreavent.reason && <span>&ldquo;{p.hiddenByCreavent.reason}&rdquo;</span>}
          <span>
            Only you and Creavent can see it. Nothing can be changed.{" "}
            <Link href="/support" className="font-semibold text-inherit">
              Contact support
            </Link>
          </span>
        </span>
      </Alert>
    )
  }
  if (p.canceled) {
    return (
      <Alert tone="danger">
        <span className="flex flex-col gap-1">
          <span className="font-semibold">This pop-up was canceled</span>
          {p.canceled.reason && <span>Your note: &ldquo;{p.canceled.reason}&rdquo;</span>}
          <span>Its page stays up marked canceled. You can duplicate it to post it again.</span>
        </span>
      </Alert>
    )
  }
  if (p.lock === "pending_review") {
    return (
      <Alert tone="warning">
        <span className="flex flex-col items-start gap-1">
          <span className="font-semibold">Locked while we review your shop</span>
          <span>Your host approval is pending review. This pop-up stays on the events page. You can edit it again once you&apos;re approved. You can still cancel it.</span>
          <Link href="/vendor/host-approval" className="font-semibold text-inherit">
            See host approval
          </Link>
        </span>
      </Alert>
    )
  }
  if (p.lock === "ended") return <Alert tone="info">This pop-up has ended. To post it again, use Duplicate in More actions.</Alert>
  return null
}

function ShareBox({ popup: p }: { popup: Popup }) {
  // Rendered only after the pop-up loads in the browser, so the origin is known.
  const url = `${typeof window === "undefined" ? "" : window.location.origin}/events/${p.slug}`
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-success/30 bg-success-soft p-4 md:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3">Your pop-up is on the events page</h2>
        <p className="text-sm">Share the link so people know where to find you.</p>
      </div>
      <p className="truncate rounded-md bg-surface px-3 py-2 font-mono text-mono">{url.replace(/^https?:\/\//, "")}</p>
      <div className="flex flex-wrap gap-2">
        <CopyTextButton text={url} label="Copy link" done="Link copied" />
        <Button asChild variant="secondary">
          <Link href={`/events/${p.slug}`}>View page</Link>
        </Button>
      </div>
      <p className="text-cap text-muted">You can change the details until it starts. The page shows &quot;Details updated&quot; with the date. Nobody is emailed.</p>
    </section>
  )
}

function AnnounceButton({ popup: p, dirty }: { popup: Popup; dirty: boolean }) {
  const saved = useSaved(p.id)
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const d = p.details

  async function announce() {
    setSaving(true)
    setError(null)
    const res = await api.POST("/api/vendor/popups/{id}/announce", { params: { path: { id: p.id } } })
    setSaving(false)
    if (!res.data) return setError(saveError(res.error).message)
    saved(res.data)
    setOpen(false)
    toast.success(`${d.name} is announced. It's on the events page now.`)
  }

  return (
    <>
      <Button type="button" variant="brand" disabled={!ready(p.checklist)} onClick={() => setOpen(true)}>
        Announce
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="md:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Announce this pop-up?</DialogTitle>
            <DialogDescription>
              It shows on the events page right away, with your shop name and &quot;Approved by Creavent&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            {d.startDate && <DateStamp date={stampDate(d.startDate)} />}
            <div className="min-w-0">
              <p className="truncate text-label font-semibold">{d.name}</p>
              <p className="text-cap text-muted">
                {[d.opensAt && d.closesAt ? `${formatTime(d.opensAt)} to ${formatTime(d.closesAt)}` : null, d.venueName].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted">You can still change the details. If plans fall through, cancel it and add a note.</p>
          {dirty && <Alert tone="warning">You have unsaved changes. Save them first.</Alert>}
          {error && <p className="text-help text-danger-ink">{error}</p>}
          <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Not yet
            </Button>
            <Button type="button" variant="brand" disabled={saving || dirty} onClick={announce}>
              Announce pop-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MoreActions({ popup: p }: { popup: Popup }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const saved = useSaved(p.id)
  const [dialog, setDialog] = React.useState<"cancel" | "delete" | null>(null)
  const [reason, setReason] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const reasonId = React.useId()
  const isPublic = p.status !== "draft"
  const canCancel = p.status === "announced" && !p.ended

  async function duplicate() {
    const res = await api.POST("/api/vendor/popups/{id}/duplicate", { params: { path: { id: p.id } } })
    if (!res.data) return toast.error(saveError(res.error).message)
    await queryClient.invalidateQueries({ queryKey: popupsKey })
    toast.success("Copied into a new draft. Pick the new dates and hours.")
    router.push(`/vendor/popups/${res.data.id}`)
  }

  async function cancel() {
    setBusy(true)
    setError(null)
    const res = await api.POST("/api/vendor/popups/{id}/cancel", { params: { path: { id: p.id } }, body: { reason: reason.trim() || null } })
    setBusy(false)
    if (!res.data) return setError(saveError(res.error).message)
    saved(res.data)
    setDialog(null)
    toast.success(`${p.details.name} is canceled. Its page says so.`)
  }

  async function remove() {
    setBusy(true)
    setError(null)
    const res = await api.DELETE("/api/vendor/popups/{id}", { params: { path: { id: p.id } } })
    setBusy(false)
    if (res.response.status !== 204) return setError(saveError(res.error).message)
    await queryClient.invalidateQueries({ queryKey: popupsKey })
    toast.success("Draft deleted")
    router.push("/vendor/popups")
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="secondary" size="icon" aria-label="More actions">
            <DotsThreeIcon aria-hidden="true" weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onSelect={duplicate}>
            <CopySimpleIcon aria-hidden="true" />
            Duplicate
          </DropdownMenuItem>
          {isPublic && (
            <DropdownMenuItem asChild>
              <Link href={`/events/${p.slug}`}>
                <GlobeSimpleIcon aria-hidden="true" />
                View public page
              </Link>
            </DropdownMenuItem>
          )}
          {(p.status === "draft" || canCancel) && <DropdownMenuSeparator />}
          {p.status === "draft" && (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
              <TrashIcon aria-hidden="true" />
              Delete draft
            </DropdownMenuItem>
          )}
          {canCancel && (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}>
              <XCircleIcon aria-hidden="true" />
              Cancel pop-up
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "cancel"} onOpenChange={(o) => setDialog(o ? "cancel" : null)}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>Cancel this pop-up?</DialogTitle>
            <DialogDescription>
              The page stays up marked &quot;Canceled&quot;, so anyone with the link knows it&apos;s off. It leaves the events page. You can&apos;t
              announce it again, but you can duplicate it.
            </DialogDescription>
          </DialogHeader>
          <Field label="Note for visitors" htmlFor={reasonId} optional help="Shown on the page as your note.">
            <Textarea id={reasonId} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {error && <p className="text-help text-danger-ink">{error}</p>}
          <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Keep it
            </Button>
            <Button type="button" variant="danger" disabled={busy} onClick={cancel}>
              Cancel pop-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={(o) => setDialog(o ? "delete" : null)}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>Delete this draft?</DialogTitle>
            <DialogDescription>It was never public, so it&apos;s deleted for good, with its cover.</DialogDescription>
          </DialogHeader>
          {error && <p className="text-help text-danger-ink">{error}</p>}
          <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Keep it
            </Button>
            <Button type="button" variant="danger" disabled={busy} onClick={remove}>
              Delete draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
