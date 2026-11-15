import type { Metadata } from "next"
import { Suspense } from "react"

import { VendorApplicationPage } from "@/components/applications/vendor-application"

export const metadata: Metadata = { title: "Application · Creavent" }

async function View({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VendorApplicationPage id={id} />
}

export default function ApplicationRoute({ params }: PageProps<"/vendor/applications/[id]">) {
  return (
    <Suspense>
      <View params={params} />
    </Suspense>
  )
}
