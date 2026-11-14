import type { Metadata } from "next"
import { Suspense } from "react"

import { EventSetupPage } from "@/components/events/event-setup"

export const metadata: Metadata = { title: "Event setup · Creavent" }

export default async function EventSetupRoute({ params }: PageProps<"/organizer/events/[id]">) {
  const { id } = await params
  return (
    <Suspense>
      <EventSetupPage id={id} />
    </Suspense>
  )
}
