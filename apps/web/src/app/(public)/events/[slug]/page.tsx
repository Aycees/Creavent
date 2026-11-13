import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Container } from "@/components/ui/container"

export const metadata: Metadata = { title: "Event · Creavent" }

export default function EventPage() {
  return (
    <Container className="py-8 md:py-12">
      <PlaceholderPage title="Event" slice="2.6 (vendor view) and 4.2 (public view)" />
    </Container>
  )
}
