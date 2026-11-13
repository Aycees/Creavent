import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Container } from "@/components/ui/container"

export const metadata: Metadata = { title: "Terms · Creavent" }

export default function TermsPage() {
  return (
    <Container className="py-8 md:py-12">
      <PlaceholderPage title="Terms" slice="4.6 (static pages)" />
    </Container>
  )
}
