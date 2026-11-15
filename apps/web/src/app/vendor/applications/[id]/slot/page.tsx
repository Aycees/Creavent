import type { Metadata } from "next"
import { Suspense } from "react"

import { PickSlotPage } from "@/components/applications/pick-slot"

export const metadata: Metadata = { title: "Pick a slot · Creavent" }

async function View({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PickSlotPage id={id} />
}

export default function PickSlotRoute({ params }: PageProps<"/vendor/applications/[id]/slot">) {
  return (
    <Suspense>
      <View params={params} />
    </Suspense>
  )
}
