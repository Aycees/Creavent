import type { Metadata } from "next"
import { Suspense } from "react"

import { EventSetupPage } from "@/components/events/event-setup"

export const metadata: Metadata = { title: "Event setup · Creavent" }

async function Setup({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EventSetupPage id={id} />
}

export default function EventSetupRoute({ params }: PageProps<"/organizer/events/[id]">) {
  return (
    <Suspense>
      <Setup params={params} />
    </Suspense>
  )
}
