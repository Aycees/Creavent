import type { Metadata } from "next"

import { PopupsPage } from "@/components/popups/popups-page"

export const metadata: Metadata = { title: "Pop-ups · Creavent" }

export default function Page() {
  return <PopupsPage />
}
