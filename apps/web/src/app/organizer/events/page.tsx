import type { Metadata } from "next"

import { OrganizerEventsList } from "@/components/events/organizer-events"

export const metadata: Metadata = { title: "Events · Creavent" }

export default function OrganizerEventsPage() {
  return <OrganizerEventsList title="Events" />
}
