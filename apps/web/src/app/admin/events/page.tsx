import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"

export const metadata: Metadata = { title: "Events · Creavent" }

export default function EventsPage() {
  return <PlaceholderPage title="Events" slice="5.2 (users and events)" />
}
