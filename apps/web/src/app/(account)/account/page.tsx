import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Container } from "@/components/ui/container"

export const metadata: Metadata = { title: "Account · Creavent" }

export default function AccountPage() {
  return (
    <Container className="py-8 md:py-12">
      <PlaceholderPage title="Account" slice="1.8 (account page)" />
    </Container>
  )
}
