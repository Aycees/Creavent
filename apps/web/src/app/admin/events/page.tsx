import type { Metadata } from "next"

import { AdminEventsList } from "@/components/admin/events-list"

export const metadata: Metadata = { title: "Events · Admin · Creavent" }

export default function EventsPage() {
  return <AdminEventsList />
}
