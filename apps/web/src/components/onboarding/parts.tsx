"use client"

import { PlusIcon, XIcon } from "@phosphor-icons/react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// The step's buttons: fixed to the bottom on phones, a row under the form on
// wider screens (design brief §14).
export function StepActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col-reverse gap-2 border-t border-border bg-surface px-4 pt-3 pb-5 shadow-up md:static md:z-auto md:flex-row md:items-center md:border-t md:bg-transparent md:px-0 md:pt-4 md:pb-0 md:shadow-none">
      {children}
    </div>
  )
}

export function StepHeading({ title, intro }: { title: string; intro: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-h1">{title}</h1>
      <p className="text-body text-muted">{intro}</p>
    </div>
  )
}

// A list of links with Remove buttons and an input to add one.
export function LinksEditor({
  id,
  label,
  placeholder,
  links,
  onChange,
  error,
}: {
  id: string
  label: string
  placeholder: string
  links: string[]
  onChange: (links: string[]) => void
  error?: string
}) {
  const [draft, setDraft] = React.useState("")
  function add() {
    const value = draft.trim()
    if (!value) return
    onChange([...links, value])
    setDraft("")
  }
  return (
    <div className="flex flex-col gap-2">
      {links.length > 0 && (
        <ul className="flex flex-col gap-2">
          {links.map((link, i) => (
            <li key={`${link}-${i}`} className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface pl-3">
              <span className="min-w-0 flex-1 truncate text-sm">{link.replace(/^https?:\/\//, "")}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${link}`}
                onClick={() => onChange(links.filter((_, j) => j !== i))}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="flex gap-2">
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
          aria-invalid={!!error}
        />
        <Button type="button" variant="secondary" onClick={add}>
          <PlusIcon aria-hidden="true" />
          Add link
        </Button>
      </div>
      {error && <p className="text-help text-danger-ink">{error}</p>}
    </div>
  )
}

// A round or square image picker for avatars and logos.
export function ImagePicker({
  label,
  hint,
  url,
  pending,
  round,
  onPick,
  onRemove,
}: {
  label: string
  hint: string
  url: string | null
  pending: boolean
  round?: boolean
  onPick: (file: File) => void
  onRemove: () => void
}) {
  const input = React.useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        aria-label={url ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
        onClick={() => input.current?.click()}
        disabled={pending}
        className={cn(
          "grid size-20 flex-none place-items-center overflow-hidden border-[1.5px] border-dashed border-border-strong bg-surface text-muted",
          round ? "rounded-pill" : "rounded-lg",
          url && "border-solid"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
        {url ? <img src={url} alt="" className="size-full object-cover" /> : <PlusIcon aria-hidden="true" className="size-6" />}
      </button>
      <div className="flex flex-col gap-1">
        <p className="text-label font-semibold">{label}</p>
        <p className="text-cap text-muted">{pending ? "Uploading…" : hint}</p>
        {url && (
          <button type="button" className="self-start text-sm text-ink underline underline-offset-2" onClick={onRemove}>
            Remove
          </button>
        )}
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
