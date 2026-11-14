import type { Metadata } from "next"
import { Suspense } from "react"

import { EventPageView } from "@/components/vendor-events/event-page"
import { Container } from "@/components/ui/container"

export const metadata: Metadata = { title: "Event · Creavent" }

async function View({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <EventPageView slug={slug} />
}

export default function EventPage({ params }: PageProps<"/events/[slug]">) {
  return (
    <Container className="py-6 md:py-10">
      <Suspense>
        <View params={params} />
      </Suspense>
    </Container>
  )
}
