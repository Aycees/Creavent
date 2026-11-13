import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Container } from "@/components/ui/container"

export const metadata: Metadata = { title: "Privacy notice · Creavent" }

export default function PrivacyNoticePage() {
  return (
    <Container className="py-8 md:py-12">
      <PlaceholderPage title="Privacy notice" slice="4.6 (static pages)" />
    </Container>
  )
}
