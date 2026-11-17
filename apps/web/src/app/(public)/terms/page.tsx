import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { LegalView } from "@/components/public/static-pages"
import { Container } from "@/components/ui/container"
import { getPublicConfig } from "@/lib/public-api"

export const metadata: Metadata = { title: "Terms of use · Creavent" }

async function View() {
  // Read when a visitor asks, not while building: the build has no API to
  // call. The config itself stays cached for hours.
  await connection()
  const config = await getPublicConfig()
  return <LegalView kind="terms" version={config.termsVersion} minimumAge={config.minimumAge} supportEmail={config.supportEmail} />
}

// /terms (sitemap §3).
export default function Page() {
  return (
    <Container className="py-8 md:py-16">
      <Suspense>
        <View />
      </Suspense>
    </Container>
  )
}
