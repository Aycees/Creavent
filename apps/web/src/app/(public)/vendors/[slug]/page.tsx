import type { Metadata } from "next"
import { Suspense } from "react"

import { NotFoundView } from "@/components/public/not-found-view"
import { VendorPageView } from "@/components/public/vendor-page"
import { Container } from "@/components/ui/container"
import { getPublicConfig, getVendorPage } from "@/lib/public-api"

export async function generateMetadata({ params }: PageProps<"/vendors/[slug]">): Promise<Metadata> {
  const page = await getVendorPage((await params).slug)
  if (!page) return { title: "Vendor · Creavent", robots: { index: false } }
  const v = page.vendor
  const description = v.description ?? `${v.shopName} sells ${v.categories.join(", ").toLowerCase() || "at Davao markets"}.`
  const image = v.photos[0] ?? v.avatarUrl
  return {
    title: `${v.shopName} · Creavent`,
    description,
    openGraph: { title: v.shopName, description, siteName: "Creavent", type: "profile", images: image ? [{ url: image }] : [] },
  }
}

async function View({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [page, config] = await Promise.all([getVendorPage(slug), getPublicConfig()])
  return page ? <VendorPageView page={page} supportEmail={config.supportEmail} /> : <NotFoundView what="vendor" />
}

// /vendors/[slug] (spec §7.2). Reached from an event's vendor list or a
// shared link; there is no vendor directory.
export default function VendorPage({ params }: PageProps<"/vendors/[slug]">) {
  return (
    <Container className="py-6 md:py-12">
      <Suspense>
        <View params={params} />
      </Suspense>
    </Container>
  )
}
