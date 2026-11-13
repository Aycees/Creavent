import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Container } from "@/components/ui/container"

export const metadata: Metadata = { title: "Approved by Creavent · Creavent" }

export default function ApprovedByCreaventPage() {
  return (
    <Container className="py-8 md:py-12">
      <PlaceholderPage title="Approved by Creavent" slice="4.6 (static pages)" />
    </Container>
  )
}
