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

// /vendor/applications/[id]/slot: pick a new preferred slot, or swap an
// unpaid slot for another (decided 2026-11-15, mockup VendorPickSlotPhone).
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
  const [picked, setPicked] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)

  if (isError) return <Alert tone="danger">We couldn&apos;t load the slots. Refresh to try again.</Alert>
  if (!data) return <p role="status" className="text-sm text-muted">Loading…</p>

  const slots = data.slotGroups.flatMap((g) => g.slots)
  const choice = slots.find((s) => s.id === (picked ?? data.preferredSlotId)) ?? null
  const current = data.currentSlotLabel

  async function save() {
    if (!choice) return
    setSending(true)
    setError(null)
    const res = current
      ? await api.POST("/api/vendor/applications/{id}/change-slot", { params: { path: { id } }, body: { preferredSlotId: choice.id } })
      : await api.PUT("/api/vendor/applications/{id}/preference", { params: { path: { id } }, body: { preferredSlotId: choice.id } })
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
        <h1 className="text-h1">{current ? "Pick another slot" : "Pick a preferred slot"}</h1>
      </div>
      <Alert tone="info">
        {current
          ? `Your new pick is a preference. ${current} opens for others, and you wait for the organizer to assign the new slot.`
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
              const mine = s.id === choice?.id
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={s.taken}
                  aria-pressed={mine}
                  aria-label={`${s.label}, ${s.taken ? "taken" : mine ? "your new pick" : "open"}`}
                  onClick={() => setPicked(s.id)}
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
        {choice && (
          <p className="flex justify-between text-sm">
            <span className="text-muted">{current ? `Change from ${current} to` : "Your pick"}</span>
            <span className="font-semibold">{`${choice.label}${choice.price != null ? ` · ${formatPeso(choice.price)}` : ""}`}</span>
          </p>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <Button disabled={!choice || sending} onClick={save} className="h-12 text-base">
          {choice ? (current ? `Release ${current} and pick ${choice.label}` : `Prefer ${choice.label}`) : "Pick an open slot"}
        </Button>
      </div>
    </div>
  )
}
