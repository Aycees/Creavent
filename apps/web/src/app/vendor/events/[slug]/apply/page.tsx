import type { Metadata } from "next"
import { Suspense } from "react"

import { ApplyPage } from "@/components/applications/apply-form"

export const metadata: Metadata = { title: "Apply · Creavent" }

async function View({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ApplyPage slug={slug} />
}

export default function ApplyRoute({ params }: PageProps<"/vendor/events/[slug]/apply">) {
  return (
    <Suspense>
      <View params={params} />
    </Suspense>
  )
}
