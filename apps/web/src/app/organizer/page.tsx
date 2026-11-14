import type { Metadata } from "next"

import { OrganizerEventsList } from "@/components/events/organizer-events"

export const metadata: Metadata = { title: "Dashboard · Creavent" }

export default function DashboardPage() {
  return <OrganizerEventsList title="Dashboard" />
}
