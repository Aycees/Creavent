import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Container } from "@/components/ui/container"

export const metadata: Metadata = { title: "Onboarding · Creavent" }

export default function OnboardingPage() {
  return (
    <Container className="py-8 md:py-12">
      <PlaceholderPage title="Onboarding" slice="1.5 (vendor onboarding) and 1.6 (organizer onboarding)" />
    </Container>
  )
}
