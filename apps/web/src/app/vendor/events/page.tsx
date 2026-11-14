import type { Metadata } from "next"

import { BrowseEvents } from "@/components/vendor-events/browse-events"

export const metadata: Metadata = { title: "Browse events · Creavent" }

export default function BrowseEventsPage() {
  return <BrowseEvents />
}
