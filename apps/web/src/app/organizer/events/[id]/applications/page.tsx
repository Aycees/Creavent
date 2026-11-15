import type { Metadata } from "next"
import { Suspense } from "react"

import { ApplicationsReview } from "@/components/organizer-vendors/applications-review"

export const metadata: Metadata = { title: "Applications · Creavent" }

async function View({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ApplicationsReview eventId={id} />
}

export default function ApplicationsPage({ params }: PageProps<"/organizer/events/[id]/applications">) {
  return (
    <Suspense>
      <View params={params} />
    </Suspense>
  )
}
