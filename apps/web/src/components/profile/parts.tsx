"use client"

import { slugSchema } from "@creavent/shared"
import { CheckIcon, GlobeIcon, PlusIcon, UploadSimpleIcon, XIcon } from "@phosphor-icons/react"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { safeLink } from "@/lib/safe-link"
import { cn } from "@/lib/utils"

export function Panel({ title, intro, aside, children, className }: { title: string; intro?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const id = React.useId()
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={id} className="text-h3">
            {title}
          </h2>
          {intro && <p className="text-sm text-muted">{intro}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

// The bar under the form: what changed, Discard, and Save changes. It sticks
// to the bottom of the screen so Save is always in reach (mockup).
export function SaveBar({
  dirty,
  changes,
  saving,
  error,
  onDiscard,
  className,
  submitLabel = "Save changes",
}: {
  dirty: boolean
  changes: string[]
  saving: boolean
  error: string | null
  onDiscard: () => void
  className?: string
  submitLabel?: string
}) {
  return (
    <div className={cn("sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-border bg-surface px-4 pt-3 pb-4 shadow-up md:mx-0 md:flex-row md:items-center md:gap-3 md:rounded-lg md:border md:px-5 md:pb-3", className)}>
      <p className={cn("flex items-center gap-2 text-sm", dirty ? "text-warning-ink" : "text-muted")} role="status">
        {dirty && <span aria-hidden="true" className="size-2 rounded-pill bg-warning" />}
        {error ?? (dirty ? `Unsaved changes${changes.length ? `: ${changes.join(", ")}` : ""}` : "No unsaved changes")}
      </p>
      <div className="flex gap-2 md:ml-auto">
        {dirty && (
          <Button type="button" variant="ghost" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
        )}
        <Button type="submit" className="flex-1 md:flex-none md:px-7" disabled={!dirty || saving}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

// The page link field with the site path and a live availability check.
export function SlugField({
  kind,
  current,
  value,
  onChange,
  error,
  help,
}: {
  kind: "vendor" | "organizer"
  current: string | null
  value: string
  onChange: (v: string) => void
  error?: string
  help: string
}) {
  const [check, setCheck] = React.useState<"idle" | "available" | "taken">("idle")
  React.useEffect(() => {
    if (value === current || !slugSchema.safeParse(value).success) return
    const timer = setTimeout(async () => {
      const { data } = await api.GET("/api/profile/slug-available", { params: { query: { kind, slug: value } } })
      setCheck(data?.available ? "available" : "taken")
    }, 350)
    return () => clearTimeout(timer)
  }, [kind, value, current])
  const changed = value !== current
  const message = error ?? (changed && check === "taken" ? "This link is taken. Try another." : undefined)
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="slug" className="text-label">
        Page link
      </label>
      <div className="flex">
        <span className="inline-flex h-11 items-center rounded-l-md border border-r-0 border-border-strong bg-sunken px-3 text-sm text-muted">
          /{kind}s/
        </span>
        <Input
          id="slug"
          autoCapitalize="none"
          className="rounded-l-none"
          value={value}
          aria-invalid={!!message}
          onChange={(e) => {
            setCheck("idle")
            onChange(e.target.value)
          }}
        />
      </div>
      {message ? (
        <p className="text-help text-danger-ink">{message}</p>
      ) : changed && check === "available" ? (
        <p className="flex items-center gap-1.5 text-help text-success-ink">
          <CheckIcon aria-hidden="true" weight="bold" className="size-4" />
          Available. Links you already shared will stop working if you change this.
        </p>
      ) : (
        <p className="text-help text-muted">{help}</p>
      )}
    </div>
  )
}

// A list of links with Remove, an optional "Reviewed" badge, and a field to
// add one.
export function LinkList({
  label,
  links,
  reviewed = [],
  placeholder,
  onChange,
  error,
}: {
  label: string
  links: string[]
  reviewed?: string[]
  placeholder: string
  onChange: (links: string[]) => void
  error?: string
}) {
  const [draft, setDraft] = React.useState("")
  const id = React.useId()
  function add() {
    const value = draft.trim()
    if (!value) return
    onChange([...links, /^https?:\/\//i.test(value) ? value : `https://${value}`])
    setDraft("")
  }
  return (
    <div className="flex flex-col gap-2">
      <ul aria-label={label} className="flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border">
        {links.map((link) => (
          <li key={link} className="flex min-h-12 items-center gap-3 pl-3">
            <GlobeIcon aria-hidden="true" className="size-5 flex-none text-muted" />
            <span className="flex min-w-0 flex-1 flex-col text-sm">
              <span className="font-semibold break-all">{safeLink(link)?.host ?? link}</span>
              {safeLink(link)?.rest && <span className="text-cap break-all text-muted">{safeLink(link)?.rest}</span>}
            </span>
            {reviewed.includes(link) && (
              <Badge tone="info" dot={false}>
                Reviewed
              </Badge>
            )}
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${link}`} onClick={() => onChange(links.filter((l) => l !== link))}>
              <XIcon aria-hidden="true" />
            </Button>
          </li>
        ))}
        <li className="flex gap-2 p-2">
          <label htmlFor={id} className="sr-only">
            Add a link
          </label>
          <Input
            id={id}
            inputMode="url"
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                add()
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={add}>
            <PlusIcon aria-hidden="true" />
            Add
          </Button>
        </li>
      </ul>
      {error && <p className="text-help text-danger-ink">{error}</p>}
    </div>
  )
}

// A picture with Upload new and Remove: the profile picture or the logo.
export function PictureEditor({
  title,
  intro,
  hint,
  url,
  fallback,
  round,
  pending,
  error,
  onPick,
  onRemove,
}: {
  title: string
  intro: string
  hint: string
  url: string | null
  fallback: string
  round?: boolean
  pending: boolean
  error: string | null
  onPick: (file: File) => void
  onRemove: () => void
}) {
  const input = React.useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-center md:gap-6 md:text-left">
      <div
        className={cn(
          "grid size-26 flex-none place-items-center overflow-hidden bg-sunken text-h2 text-muted md:size-28",
          round ? "rounded-pill" : "rounded-xl"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
        {url ? <img src={url} alt="" className="size-full object-cover" /> : <span aria-hidden="true">{fallback}</span>}
      </div>
      <div className="flex flex-col gap-2">
        <div>
          <h2 className="text-h3">{title}</h2>
          <p className="text-sm text-muted">{intro}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 md:justify-start">
          <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => input.current?.click()}>
            <UploadSimpleIcon aria-hidden="true" className="size-4" />
            {pending ? "Uploading…" : "Upload new"}
          </Button>
          {url && (
            <Button type="button" variant="danger-ghost" size="sm" onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>
        <p className="text-cap text-muted">{hint}</p>
        {error && <p className="text-help text-danger-ink">{error}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPick(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}
