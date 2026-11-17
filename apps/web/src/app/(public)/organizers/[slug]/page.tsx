import type { Metadata } from "next"
import { Suspense } from "react"

import { ReportLink } from "@/components/reports/report-link"
import { NotFoundView } from "@/components/public/not-found-view"
import { OrganizerPageView } from "@/components/public/organizer-page"
import { Container } from "@/components/ui/container"
import { getOrganizerPage, getPublicConfig } from "@/lib/public-api"

export async function generateMetadata({ params }: PageProps<"/organizers/[slug]">): Promise<Metadata> {
  const page = await getOrganizerPage((await params).slug)
  if (!page) return { title: "Organizer · Creavent", robots: { index: false } }
  const o = page.organizer
  const description = o.about ?? `Events by ${o.displayName} on Creavent.`
  return {
    title: `${o.displayName} · Creavent`,
    description,
    openGraph: { title: o.displayName, description, siteName: "Creavent", type: "profile", images: o.logoUrl ? [{ url: o.logoUrl }] : [] },
  }
}

async function View({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [page, config] = await Promise.all([getOrganizerPage(slug), getPublicConfig()])
  return page ? (
    <OrganizerPageView
      page={page}
      supportEmail={config.supportEmail}
      report={<ReportLink targetType="organizer" targetId={page.organizer.id} supportEmail={config.supportEmail} />}
    />
  ) : <NotFoundView what="organizer" />
}

// /organizers/[slug] (spec §7.1).
export default function OrganizerPage({ params }: PageProps<"/organizers/[slug]">) {
  return (
    <Container className="py-6 md:py-12">
      <Suspense>
        <View params={params} />
      </Suspense>
    </Container>
  )
}
