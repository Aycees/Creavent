"use client"

import { formatPeso, MAX_FILES_PER_DOCUMENT, type ApplyBlock, type ApplyForm } from "@creavent/shared"
import { ArrowLeftIcon, CheckIcon, FileTextIcon, ImageIcon, InfoIcon, XIcon } from "@phosphor-icons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { formatDateTime, formatDay } from "@/lib/event-format"
import { useUpload } from "@/lib/use-upload"
import { cn } from "@/lib/utils"

type ErrorBody = { message?: string } | undefined
type Uploaded = { id: string; name: string }

function useApplyForm(slug: string) {
  return useQuery({
    queryKey: ["apply-form", slug],
    queryFn: async (): Promise<ApplyForm | null> => {
      const { data, response } = await api.GET("/api/vendor/events/{slug}/apply", { params: { path: { slug } } })
      if (response.status === 404) return null
      if (!data) throw new Error(`GET /api/vendor/events/${slug}/apply failed with ${response.status}`)
      return data
    },
  })
}

const blockText: Record<ApplyBlock, string> = {
  closed: "Applications are closed for this event.",
  already_applied: "You already applied to this event.",
  cannot_reapply: "You can't reapply to this event.",
  no_matching_category: "None of your shop's categories are accepted at this event.",
  profile_incomplete: "Add your shop name, mobile number, and a category before you apply.",
}

// /vendor/events/[slug]/apply (spec §4.2, §4.3, mockup VendorApply).
export function ApplyPage({ slug }: { slug: string }) {
  const { data, isError } = useApplyForm(slug)
  if (isError) return <Alert tone="danger">We couldn&apos;t load this form. Refresh to try again.</Alert>
  if (data === undefined) return <p role="status" className="text-sm text-muted">Loading…</p>
  if (data === null) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-h1">Event not found</h1>
        <Button asChild variant="secondary">
          <Link href="/vendor/events">Browse events</Link>
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-6 pb-44 md:pb-16">
      <div className="flex flex-col gap-2">
        <Link href={`/events/${data.event.slug}`} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-muted hover:text-ink">
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          {data.event.name}
        </Link>
        <h1 className="text-h1">Apply to sell</h1>
        <p className="text-body text-muted">{eventLine(data)}</p>
      </div>
      {data.blocked ? <Blocked form={data} reason={data.blocked} /> : <Form form={data} />}
    </div>
  )
}

function eventLine({ event: e }: ApplyForm) {
  const dates = e.startDate && e.endDate ? (e.startDate === e.endDate ? formatDay(e.startDate) : `${formatDay(e.startDate)} to ${formatDay(e.endDate)}`) : null
  const close = e.applicationsCloseAt ? `Applications close ${formatDateTime(e.applicationsCloseAt)}` : null
  return [dates, e.venueName, close].filter(Boolean).join(" · ")
}

function Blocked({ form, reason }: { form: ApplyForm; reason: ApplyBlock }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-body">{blockText[reason]}</p>
      {reason === "already_applied" && form.activeApplicationId ? (
        <Button asChild>
          <Link href={`/vendor/applications/${form.activeApplicationId}`}>See your application</Link>
        </Button>
      ) : reason === "profile_incomplete" ? (
        <Button asChild>
          <Link href="/vendor/profile">Finish your profile</Link>
        </Button>
      ) : (
        <Button asChild variant="secondary">
          <Link href={`/events/${form.event.slug}`}>Back to the event</Link>
        </Button>
      )}
    </div>
  )
}

function Form({ form }: { form: ApplyForm }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [categoryIds, setCategoryIds] = React.useState<string[]>([])
  const [files, setFiles] = React.useState<Record<string, Uploaded[]>>({})
  const [slotId, setSlotId] = React.useState<string | null>(null)
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)

  const documents = form.documents.filter((d) => d.categoryId === null || categoryIds.includes(d.categoryId))
  const slots = form.slotGroups.flatMap((g) => g.slots.map((s) => ({ ...s, group: g.name })))
  const picked = slots.find((s) => s.id === slotId) ?? null
  const prices = slots.flatMap((s) => (s.price === null ? [] : [s.price]))
  const toggle = (id: string) => setCategoryIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (categoryIds.length === 0) return setError("Pick at least one category")
    const missing = documents.find((d) => d.required && !(files[d.id]?.length))
    if (missing) return setError(`Upload your ${missing.name}`)
    setSending(true)
    const res = await api.POST("/api/vendor/events/{slug}/applications", {
      params: { path: { slug: form.event.slug } },
      body: {
        categoryIds,
        documents: documents.filter((d) => files[d.id]?.length).map((d) => ({ requirementId: d.id, fileIds: files[d.id].map((f) => f.id) })),
        preferredSlotId: slotId,
        note,
      },
    })
    setSending(false)
    if (!res.data) return setError((res.error as ErrorBody)?.message ?? "Something went wrong. Try again.")
    void queryClient.invalidateQueries()
    router.push(`/vendor/applications/${res.data.id}`)
  }

  const summary = (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted">Selling</dt>
      <dd>{form.categories.filter((c) => categoryIds.includes(c.id)).map((c) => c.name).join(", ") || "Pick a category"}</dd>
      <dt className="text-muted">Documents</dt>
      <dd>{`${documents.filter((d) => files[d.id]?.length).length} of ${documents.length} uploaded`}</dd>
      {form.event.preferredSlots && (
        <>
          <dt className="text-muted">Preferred slot</dt>
          <dd>{picked ? <><span className="font-mono">{picked.label}</span>{` · ${picked.group}`}</> : "No preference"}</dd>
        </>
      )}
      <dt className="text-muted">Fee if assigned</dt>
      <dd className="font-semibold tabular-nums">{picked?.price != null ? formatPeso(picked.price) : feeRange(prices)}</dd>
      <dt className="text-muted">Pay within</dt>
      <dd>{form.event.deadlineHours} hours of assignment</dd>
    </dl>
  )

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-8 md:grid md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-10">
      <div className="flex flex-col gap-8">
        <section aria-labelledby="sell-h" className="flex flex-col gap-3">
          <div>
            <h2 id="sell-h" className="text-h2">What you&apos;ll sell</h2>
            <p className="text-sm text-muted">From your shop profile. Pick the categories you&apos;ll sell here.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {form.categories.map((c) => {
              const on = categoryIds.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(c.id)}
                  className={cn(
                    "flex min-h-11 items-start gap-3.5 rounded-lg border bg-surface p-4 text-left",
                    on ? "border-2 border-ink p-[15px]" : "border-border-strong"
                  )}
                >
                  <span aria-hidden="true" className={cn("grid size-5 flex-none place-items-center rounded-xs border", on ? "border-ink bg-ink text-on-inverse" : "border-border-strong")}>
                    {on && <CheckIcon className="size-3.5" weight="bold" />}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-label font-semibold">{c.name}</span>
                    <span className="text-cap text-muted">{c.max === null ? "No limit" : `${c.left} of ${c.max} spots left`}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {form.documents.length > 0 && (
          <section aria-labelledby="docs-h" className="flex flex-col gap-3">
            <h2 id="docs-h" className="text-h2">Documents</h2>
            {documents.map((d) => (
              <DocumentUpload
                key={d.id}
                name={d.name}
                description={d.description}
                required={d.required}
                files={files[d.id] ?? []}
                onChange={(list) => setFiles((all) => ({ ...all, [d.id]: list }))}
              />
            ))}
            {form.documents
              .filter((d) => d.categoryId !== null && !categoryIds.includes(d.categoryId))
              .map((d) => (
                <p key={d.id} className="text-cap text-muted">{`${d.name} is only needed for ${d.categoryName}.`}</p>
              ))}
          </section>
        )}

        {form.event.preferredSlots && (
          <section aria-labelledby="pref-h" className="flex flex-col gap-4">
            <div>
              <h2 id="pref-h" className="text-h2">
                Preferred slot <span className="text-lg font-normal text-muted">(optional)</span>
              </h2>
              <p className="text-sm text-muted">The organizer lets vendors choose. Pick an open slot, or skip this.</p>
            </div>
            <Alert tone="info">Your pick isn&apos;t reserved until the organizer assigns it. Other vendors may pick the same slot.</Alert>
            {form.event.vendorFloorPlanUrl ? (
              <a href={form.event.vendorFloorPlanUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
                <img src={form.event.vendorFloorPlanUrl} alt="Vendor floor plan, numbered empty slots. Opens full size." className="w-full object-contain" />
              </a>
            ) : null}
            <ul className="flex flex-wrap gap-4 text-cap text-muted" aria-label="Key">
              <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3.5 rounded-xs border-[1.5px] border-dashed border-border-strong bg-surface" />Open</li>
              <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3.5 rounded-xs bg-inverse" />Your pick</li>
              <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3.5 rounded-xs border-[1.5px] border-border-strong bg-sunken opacity-60" />Taken</li>
            </ul>
            {form.slotGroups.map((g) => {
              const open = g.slots.filter((s) => !s.taken).length
              return (
                <div key={g.name} className="flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="text-h3">{g.name}</h3>
                    <span className="text-sm text-muted">{open ? `${open} of ${g.slots.length} open` : "Full"}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2 md:grid-cols-[repeat(auto-fill,minmax(64px,1fr))]">
                    {g.slots.map((s) => {
                      const mine = s.id === slotId
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={s.taken}
                          aria-pressed={mine}
                          aria-label={`${s.label}, ${s.taken ? "taken" : mine ? "your pick" : "open"}`}
                          title={[s.sizeLabel, s.note, s.price != null ? formatPeso(s.price) : null].filter(Boolean).join(", ")}
                          onClick={() => setSlotId(s.id)}
                          className={cn(
                            "grid h-12 place-items-center rounded-xs border-[1.5px] font-mono text-[12px] font-medium",
                            s.taken
                              ? "cursor-not-allowed border-border-strong bg-sunken text-ink line-through opacity-60"
                              : mine
                                ? "border-inverse bg-inverse text-on-inverse"
                                : "border-dashed border-border-strong bg-surface text-muted hover:border-ink hover:text-ink"
                          )}
                        >
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <button
              type="button"
              aria-pressed={slotId === null}
              onClick={() => setSlotId(null)}
              className={cn(
                "flex min-h-11 items-start gap-3.5 rounded-lg border bg-surface p-4 text-left",
                slotId === null ? "border-2 border-ink p-[15px]" : "border-border-strong"
              )}
            >
              <span aria-hidden="true" className={cn("grid size-5 flex-none place-items-center rounded-full border", slotId === null ? "border-ink bg-ink text-on-inverse" : "border-border-strong")}>
                {slotId === null && <CheckIcon className="size-3.5" weight="bold" />}
              </span>
              <span className="flex flex-col">
                <span className="text-label font-semibold">No preference</span>
                <span className="text-cap text-muted">The organizer picks a slot for you.</span>
              </span>
            </button>
          </section>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="apply-note" className="text-label">
            Note to the organizer <span className="font-normal text-muted">(optional)</span>
          </label>
          <Textarea id="apply-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="For example, I'd like to be near other clothing stalls." />
        </div>

        <section aria-labelledby="policy-h" className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-4 md:p-5">
          <h2 id="policy-h" className="text-h3">Cancellation and withdrawal policy</h2>
          <p className="text-sm whitespace-pre-line">{form.event.policy || "The organizer hasn't written a policy yet."}</p>
          <p className="text-cap text-muted">Creavent doesn&apos;t handle payments or refunds.</p>
        </section>
      </div>

      {/* Desktop: a sticky summary with the submit button. Phones: the
          summary's key line and the button in the sticky bar. */}
      <aside aria-label="Your application" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm md:sticky md:top-6 md:p-6">
        <h2 className="text-h3">Your application</h2>
        {summary}
        {error && <Alert tone="danger">{error}</Alert>}
        {/* Phones: a sticky bar just above the vendor tab bar. */}
        <div className="flex flex-col gap-2 max-md:fixed max-md:inset-x-0 max-md:bottom-18 max-md:z-10 max-md:border-t max-md:border-border max-md:bg-surface max-md:px-4 max-md:py-3 max-md:shadow-up">
          <Button type="submit" variant="brand" block disabled={sending} className="h-12 text-base">
            Submit application
          </Button>
          <p className="text-center text-cap text-muted">By applying you accept the event&apos;s policy.</p>
        </div>
      </aside>
    </form>
  )
}

function feeRange(prices: number[]) {
  if (prices.length === 0) return "Set by the organizer"
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? formatPeso(min) : `${formatPeso(min)} to ${formatPeso(max)}`
}

// One requirement: up to 3 files, each a photo or PDF (spec §11.1).
function DocumentUpload({
  name,
  description,
  required,
  files,
  onChange,
}: {
  name: string
  description: string | null
  required: boolean
  files: Uploaded[]
  onChange: (files: Uploaded[]) => void
}) {
  const id = React.useId()
  const { upload, pending, error } = useUpload("application_document")

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    const done = await upload(file)
    if (done) onChange([...files, { id: done.id, name: file.name }])
  }

  const done = files.length > 0
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {done ? (
          <CheckIcon aria-hidden="true" className="size-5 flex-none text-success" weight="bold" />
        ) : (
          <FileTextIcon aria-hidden="true" className="size-5 flex-none text-muted" />
        )}
        <div className="min-w-0 flex-[1_1_200px]">
          <p className="text-label font-semibold">{name}</p>
          <p className="text-cap text-muted">{description ?? (required ? "Required. A photo or PDF, up to 10 MB." : "Optional. A photo or PDF, up to 10 MB.")}</p>
        </div>
        {files.length < MAX_FILES_PER_DOCUMENT && (
          <label htmlFor={id} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-4 text-label has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus">
            {pending ? "Uploading…" : done ? "Add a file" : "Upload"}
            <input id={id} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" aria-label={`Upload ${name}`} className="sr-only" onChange={pick} disabled={pending} />
          </label>
        )}
      </div>
      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-sm">
              {f.name.toLowerCase().endsWith(".pdf") ? <FileTextIcon aria-hidden="true" className="size-4 text-muted" /> : <ImageIcon aria-hidden="true" className="size-4 text-muted" />}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((x) => x.id !== f.id))}>
                <XIcon aria-hidden="true" className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="flex items-center gap-1.5 text-help text-danger-ink">
          <InfoIcon aria-hidden="true" className="size-4" />
          {error}
        </p>
      )}
    </div>
  )
}
