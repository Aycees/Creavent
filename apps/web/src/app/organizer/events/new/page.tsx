import type { Metadata } from "next"

import { CreateEvent } from "@/components/events/create-event"

export const metadata: Metadata = { title: "Create event · Creavent" }

export default function CreateEventPage() {
  return <CreateEvent />
}
