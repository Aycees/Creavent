import type { Metadata } from "next"

import { CreatePopup } from "@/components/popups/create-popup"

export const metadata: Metadata = { title: "Host a pop-up · Creavent" }

export default function Page() {
  return <CreatePopup />
}
