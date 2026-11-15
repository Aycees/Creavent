import type { Metadata } from "next"
import { Suspense } from "react"

import { VendorsAndSlots } from "@/components/organizer-vendors/vendors-slots"

export const metadata: Metadata = { title: "Vendors and slots · Creavent" }

async function View({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VendorsAndSlots eventId={id} />
}

export default function VendorsPage({ params }: PageProps<"/organizer/events/[id]/vendors">) {
  return (
    <Suspense>
      <View params={params} />
    </Suspense>
  )
}
