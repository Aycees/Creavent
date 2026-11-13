import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"

export const metadata: Metadata = { title: "Event · Creavent" }

export default function EventPage() {
  return <PlaceholderPage title="Event" slice="5.2 (users and events)" />
}
