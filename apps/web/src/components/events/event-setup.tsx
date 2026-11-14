"use client"

import type { EventSetup } from "@creavent/shared"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateStamp } from "@/components/ui/date-stamp"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { stampDate } from "@/lib/event-format"
import { DetailsTab } from "./details-tab"
import { RequirementsTab } from "./requirements-tab"
import { ApplicationsPanel, Checklist, DeleteDraftButton, OpenButton } from "./open-controls"
import { EventStatusBadge } from "./parts"
import { PaymentsTab } from "./payments-tab"
import { PolicyTab } from "./policy-tab"
import { PublicFloorPlanTab } from "./public-floor-plan-tab"
import { SlotsTab } from "./slots-tab"
import { useEventSetup } from "./queries"

export const setupTabs = [
  { id: "details", label: "Details" },
  { id: "requirements", label: "Requirements" },
  { id: "policy", label: "Policy" },
  { id: "payments", label: "Payments" },
  { id: "slots", label: "Slots" },
  { id: "public-floor-plan", label: "Public floor plan" },
] as const
export type SetupTab = (typeof setupTabs)[number]["id"]

function isTab(value: string | null): value is SetupTab {
  return setupTabs.some((t) => t.id === value)
}

// /organizer/events/[id]: one page with tabs, so a draft can be filled in any
// order (sitemap §4, mockup OrgEventSetup and its tabs).
export function EventSetupPage({ id }: { id: string }) {
  const { data: setup, isError } = useEventSetup(id)
  if (isError) return <Alert tone="danger">We couldn&apos;t load this event. Refresh to try again.</Alert>
  if (setup === undefined) return <p role="status" className="text-sm text-muted">Loading…</p>
  if (setup === null) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-h1">Event not found</h1>
        <p className="text-body text-muted">We couldn&apos;t find this event.</p>
        <Button asChild variant="secondary">
          <Link href="/organizer">Back to your events</Link>
        </Button>
      </div>
    )
  }
  return <Setup setup={setup} />
}

function Setup({ setup }: { setup: EventSetup }) {
  const params = useSearchParams()
  const initial = params.get("tab")
  const [tab, setTab] = React.useState<SetupTab>(isTab(initial) ? initial : "details")
  const d = setup.details
  const type = setup.eventTypes.find((t) => t.id === d.eventTypeId)

  function choose(next: string) {
    if (!isTab(next)) return
    setTab(next)
    window.history.replaceState(null, "", `?tab=${next}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        {d.startDate && <DateStamp date={stampDate(d.startDate)} />}
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-h1">{d.name}</h1>
            <EventStatusBadge status={setup.status} />
            {type && <Badge dot={false}>{type.name}</Badge>}
          </div>
          {setup.status === "draft" && <p className="text-sm text-muted">Only you can see this event.</p>}
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-start">
          <Button asChild variant="secondary">
            <Link href={`/events/${setup.slug}`}>Preview as vendor</Link>
          </Button>
          {setup.status === "draft" && <OpenButton setup={setup} />}
          {setup.status === "draft" && <DeleteDraftButton setup={setup} />}
        </div>
      </div>

      {setup.status === "draft" ? <Checklist checklist={setup.checklist} onGo={choose} /> : <ApplicationsPanel setup={setup} />}

      <Tabs value={tab} onValueChange={choose}>
        <TabsList aria-label="Event setup">
          {setupTabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="details">
          <DetailsTab setup={setup} />
        </TabsContent>
        <TabsContent value="requirements">
          <RequirementsTab setup={setup} />
        </TabsContent>
        <TabsContent value="policy">
          <PolicyTab setup={setup} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab setup={setup} />
        </TabsContent>
        <TabsContent value="slots">
          <SlotsTab setup={setup} />
        </TabsContent>
        <TabsContent value="public-floor-plan">
          <PublicFloorPlanTab setup={setup} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
