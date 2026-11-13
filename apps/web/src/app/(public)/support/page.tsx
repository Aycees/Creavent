import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Container } from "@/components/ui/container"

export const metadata: Metadata = { title: "Support · Creavent" }

export default function SupportPage() {
  return (
    <Container className="py-8 md:py-12">
      <PlaceholderPage title="Support" slice="4.6 (static pages)" />
    </Container>
  )
}
