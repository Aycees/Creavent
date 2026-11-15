import type { Metadata } from "next"
import { Suspense } from "react"

import { ApplicationDetailPage } from "@/components/organizer-applications/application-detail"

export const metadata: Metadata = { title: "Application · Creavent" }

async function View({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ApplicationDetailPage id={id} />
}

export default function ApplicationRoute({ params }: PageProps<"/organizer/applications/[id]">) {
  return (
    <Suspense>
      <View params={params} />
    </Suspense>
  )
}
