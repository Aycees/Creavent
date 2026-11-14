"use client"

import type { EventSetup } from "@creavent/shared"
import * as React from "react"
import { toast } from "sonner"

import { Alert } from "@/components/ui/alert"
import { api } from "@/lib/api"
import { saveError, useSetupSaved } from "./queries"
import { FloorPlanPanel } from "./slots-tab"

// The Public floor plan tab (spec §3.4, mockup OrgEventPublicFloorPlan).
export function PublicFloorPlanTab({ setup }: { setup: EventSetup }) {
  const saved = useSetupSaved(setup.id)
  const [error, setError] = React.useState<string | null>(null)

  async function change(fileId: string | null) {
    setError(null)
    const res = await api.PUT("/api/organizer/events/{id}/public-floor-plan", { params: { path: { id: setup.id } }, body: { fileId } })
    if (!res.data) return setError(saveError(res.error).message)
    saved(res.data)
    toast.success(fileId ? "Public floor plan saved" : "Public floor plan removed")
  }

  return (
    <div className="flex max-w-160 flex-col gap-6">
      <Alert tone="info">Upload this after your vendors are final. Visitors see it on the event page once you announce the event.</Alert>
      <FloorPlanPanel
        title="Public floor plan"
        purpose="public_floor_plan"
        image={setup.slots.publicFloorPlan}
        help="The layout with vendors placed, made in any tool. Use the slot numbers from your slot list so visitors can find each vendor. We don't check that they match."
        onChange={change}
      />
      {error && <Alert tone="danger">{error}</Alert>}
      <p className="text-cap text-muted">Not required to open to vendors or to announce. You can replace it any time, for example after a vendor drops out.</p>
    </div>
  )
}
