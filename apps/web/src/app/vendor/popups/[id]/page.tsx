import type { Metadata } from "next"
import { Suspense } from "react"

import { PopupEditor } from "@/components/popups/popup-form"

export const metadata: Metadata = { title: "Pop-up · Creavent" }

async function View({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PopupEditor id={id} />
}

export default function PopupRoute({ params }: PageProps<"/vendor/popups/[id]">) {
  return (
    <Suspense>
      <View params={params} />
    </Suspense>
  )
}
