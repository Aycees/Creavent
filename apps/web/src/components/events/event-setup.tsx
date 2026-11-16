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
import { eventDays, stampDate } from "@/lib/event-format"
import { DetailsTab } from "./details-tab"
import { RequirementsTab } from "./requirements-tab"
import { EventTabs } from "@/components/organizer-vendors/event-tabs"
import { EventActionsMenu } from "./event-actions-menu"
import { AnnounceButton, CanceledNotice } from "./lifecycle-controls"
import { Checklist, OpenButton } from "./open-controls"
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
  const days = eventDays(d)

  function choose(next: string) {
    if (!isTab(next)) return
    setTab(next)
    window.history.replaceState(null, "", `?tab=${next}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <EventTabs
        eventId={setup.id}
        name={d.name}
        current="setup"
        nav={setup.status !== "draft"}
        stamp={d.startDate && <DateStamp date={stampDate(d.startDate)} endDay={days > 1 && d.endDate ? Number(d.endDate.slice(8)) : undefined} />}
        meta={
          <>
            <div className="flex flex-wrap items-center gap-2">
              <EventStatusBadge status={setup.status} />
              {type && <Badge dot={false}>{type.name}</Badge>}
            </div>
            {!setup.canceled && <p className="max-w-[560px] text-sm text-muted">{statusLine(setup)}</p>}
          </>
        }
      >
        {/* The one next step, then everything else under More actions. On
            phones the step fills the row beside the menu. */}
        <div className="flex-1 md:flex-none [&_button]:max-md:w-full">
          {setup.status === "draft" ? <OpenButton setup={setup} /> : <AnnounceButton setup={setup} />}
        </div>
        <EventActionsMenu setup={setup} />
      </EventTabs>

      {setup.canceled ? (
        <CanceledNotice canceled={setup.canceled} />
      ) : (
        setup.status === "draft" && <Checklist checklist={setup.checklist} onGo={choose} />
      )}

      <Tabs value={tab} onValueChange={choose}>
        {/* The sections of this page, as pills: the underline tabs above
            are the event's pages, so the two levels never look alike. */}
        <TabsList aria-label="Event setup" className="-mx-4 gap-2 px-4 shadow-none md:mx-0 md:px-0">
          {setupTabs.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="h-11 rounded-pill border border-border-strong bg-surface px-4 text-ink hover:text-ink data-active:border-inverse data-active:bg-inverse data-active:text-on-inverse md:h-10"
            >
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

// One line under the name: who can see the event and whether vendors can
// apply, instead of a panel of its own.
function statusLine(setup: EventSetup) {
  const applications = setup.applicationsOpen ? "open" : "closed"
  switch (setup.status) {
    case "draft":
      return "Only you can see this draft."
    case "open_to_vendors":
      if (setup.ended) return "This event has ended."
      return setup.applicationsOpen
        ? "Applications are open. Vendors can find this event and apply. Visitors can't see it yet."
        : "Applications are closed. Vendors can still see this event. Visitors can't see it yet."
    case "announced":
      return `Announced, on the event listing. Applications are ${applications}.`
    default:
      return "Completed. It stays on your organizer page as a past event."
  }
}
