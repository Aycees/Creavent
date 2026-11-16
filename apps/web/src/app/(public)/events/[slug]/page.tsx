import type { Metadata } from "next"
import { Suspense } from "react"

import { CanceledNoticeView, NotPublicView, PublicEventView } from "@/components/public/public-event"
import { NotFoundView } from "@/components/public/not-found-view"
import { EventPageView } from "@/components/vendor-events/event-page"
import { Container } from "@/components/ui/container"
import { formatSchedule } from "@/lib/event-format"
import { getPublicConfig, getPublicEvent } from "@/lib/public-api"

// Open Graph tags, so a link shared on Facebook shows the cover, name, and
// date (architecture §8).
export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const data = await getPublicEvent(slug)
  if (!data || data.page.view !== "public") return { title: "Event · Creavent", robots: { index: false } }
  const e = data.page.event
  const description = [formatSchedule(e), [e.venueName, e.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ")
  return {
    title: `${e.name} · Creavent`,
    description,
    openGraph: { title: e.name, description, type: "website", siteName: "Creavent", images: e.coverUrl ? [{ url: e.coverUrl, width: 1600, height: 900 }] : [] },
  }
}

async function View({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [data, config] = await Promise.all([getPublicEvent(slug), getPublicConfig()])
  const page = data?.page
  return (
    // The cached public page for everyone; a signed-in viewer's own view
    // replaces it in the browser (sitemap §3).
    <EventPageView slug={slug} supportEmail={config.supportEmail}>
      {!page ? (
        <NotFoundView what="event" />
      ) : page.view === "public" ? (
        <PublicEventView event={page.event} supportEmail={config.supportEmail} />
      ) : page.view === "not_public" ? (
        <NotPublicView />
      ) : (
        <CanceledNoticeView {...page} />
      )}
    </EventPageView>
  )
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
