import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Container } from "@/components/ui/container"

export const metadata: Metadata = { title: "Events · Creavent" }

export default function EventsPage() {
  return (
    <Container className="py-8 md:py-12">
      <PlaceholderPage title="Events" slice="4.3 (event listing)" />
    </Container>
  )
}
