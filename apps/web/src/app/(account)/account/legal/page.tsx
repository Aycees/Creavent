import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Container } from "@/components/ui/container"

export const metadata: Metadata = { title: "Updated terms · Creavent" }

export default function UpdatedTermsPage() {
  return (
    <Container className="py-8 md:py-12">
      <PlaceholderPage title="Updated terms" slice="1.3 (sign up and sign in)" />
    </Container>
  )
}
