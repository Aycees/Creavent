import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Container } from "@/components/ui/container"

export const metadata: Metadata = { title: "Organizer · Creavent" }

export default function OrganizerPage() {
  return (
    <Container className="py-8 md:py-12">
      <PlaceholderPage title="Organizer" slice="4.4 (organizer page)" />
    </Container>
  )
}
