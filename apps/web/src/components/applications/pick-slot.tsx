"use client"

import { formatPeso, type ApplicationSlots } from "@creavent/shared"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

type ErrorBody = { message?: string } | undefined

// /vendor/applications/[id]/slot: pick new preferred slots, or swap unpaid
// slots for others, up to as many as the vendor asked for (decided
// 2026-11-15, decisions P4 to P6, mockup VendorPickSlotPhone).
export function PickSlotPage({ id }: { id: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data, isError } = useQuery({
    queryKey: ["application-slots", id],
    queryFn: async (): Promise<ApplicationSlots> => {
      const { data, response } = await api.GET("/api/vendor/applications/{id}/slots", { params: { path: { id } } })
      if (!data) throw new Error(`GET /api/vendor/applications/${id}/slots failed with ${response.status}`)
      return data
    },
  })
  const [picked, setPicked] = React.useState<string[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)

  if (isError) return <Alert tone="danger">We couldn&apos;t load the slots. Refresh to try again.</Alert>
  if (!data) return <p role="status" className="text-sm text-muted">Loading…</p>

  const max = data.slotsRequested
  const many = max > 1
  const ids = picked ?? data.preferredSlotIds
  const choice = data.slotGroups.flatMap((g) => g.slots).filter((s) => ids.includes(s.id))
  const label = choice.map((s) => s.label).join(", ")
  const total = choice.reduce((sum, s) => sum + (s.price ?? 0), 0)
  const current = data.currentSlotLabel
  const currentMany = current?.includes(", ") ?? false
  const pick = (slotId: string) =>
    setPicked(!many ? [slotId] : ids.includes(slotId) ? ids.filter((x) => x !== slotId) : ids.length < max ? [...ids, slotId] : ids)

  async function save() {
    if (choice.length === 0) return
    setSending(true)
    setError(null)
    const body = { preferredSlotIds: choice.map((s) => s.id) }
    const res = current
      ? await api.POST("/api/vendor/applications/{id}/change-slot", { params: { path: { id } }, body })
      : await api.PUT("/api/vendor/applications/{id}/preference", { params: { path: { id } }, body })
    setSending(false)
    if (!res.data) return setError((res.error as ErrorBody)?.message ?? "Something went wrong. Try again.")
    void queryClient.invalidateQueries()
    router.push(`/vendor/applications/${id}`)
  }

  return (
    <div className="flex flex-col gap-5 pb-48 md:pb-16">
      <div className="flex flex-col gap-2">
        <Link href={`/vendor/applications/${id}`} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-muted hover:text-ink">
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          Back to your application
        </Link>
        <h1 className="text-h1">{current ? (many ? "Pick other slots" : "Pick another slot") : many ? "Pick preferred slots" : "Pick a preferred slot"}</h1>
      </div>
      <Alert tone="info">
        {current
          ? currentMany
            ? `Pick up to ${max}. Your new picks are preferences. ${current.replace(", ", " and ")} open for others together, and you wait for the organizer to assign the new slots.`
            : `Your new pick is a preference. ${current} opens for others, and you wait for the organizer to assign the new slot.`
          : many
            ? `Pick up to ${max}. Your picks aren't reserved until the organizer assigns them. Other vendors may pick the same slots.`
            : "Your pick isn't reserved until the organizer assigns it. Other vendors may pick the same slot."}
      </Alert>
      {data.vendorFloorPlanUrl && (
        <a href={data.vendorFloorPlanUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
          <img src={data.vendorFloorPlanUrl} alt="Vendor floor plan, numbered empty slots. Opens full size." className="w-full object-contain" />
        </a>
      )}
      {data.slotGroups.map((g) => (
        <div key={g.name} className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className="text-h3">{g.name}</h2>
            <span className="text-sm text-muted">{`${g.slots.filter((s) => !s.taken).length} of ${g.slots.length} open`}</span>
          </div>
          <div className="grid grid-cols-5 gap-2 md:grid-cols-[repeat(auto-fill,minmax(64px,1fr))]">
            {g.slots.map((s) => {
              const mine = ids.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={s.taken}
                  aria-pressed={mine}
                  aria-label={`${s.label}, ${s.taken ? "taken" : mine ? "your new pick" : "open"}`}
                  onClick={() => pick(s.id)}
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
      ))}
      <div className="flex flex-col gap-2 max-md:fixed max-md:inset-x-0 max-md:bottom-18 max-md:z-10 max-md:border-t max-md:border-border max-md:bg-surface max-md:px-4 max-md:py-3 max-md:shadow-up md:max-w-sm">
        {many && (
          <p className="text-cap text-muted" aria-live="polite">
            {`${choice.length} of ${max} picked.${choice.length >= max ? " Tap a pick to change it." : ""}`}
          </p>
        )}
        {choice.length > 0 && (
          <p className="flex justify-between gap-3 text-sm">
            <span className="text-muted">{current ? `Change from ${current} to` : many ? "Your picks" : "Your pick"}</span>
            <span className="font-semibold">
              {label}
              {choice.every((s) => s.price != null) && <span className="tabular-nums">{` · ${formatPeso(total)}`}</span>}
            </span>
          </p>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <Button disabled={choice.length === 0 || sending} onClick={save} className="h-12 text-base">
          {choice.length ? (current ? `Release ${!currentMany ? current : current!.split(", ").length === 2 ? "both" : "all"} and pick ${label}` : `Prefer ${label}`) : many ? "Pick open slots" : "Pick an open slot"}
        </Button>
      </div>
    </div>
  )
}
