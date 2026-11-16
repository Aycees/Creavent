import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminEventDetail } from "@/components/admin/event-detail"

export const metadata: Metadata = { title: "Event · Admin · Creavent" }

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AdminEventDetail eventId={id} />
}

export default function EventPage({ params }: PageProps<"/admin/events/[id]">) {
  return (
    <Suspense>
      <Detail params={params} />
    </Suspense>
  )
}
