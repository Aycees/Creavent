import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Container } from "@/components/ui/container"

export const metadata: Metadata = { title: "Vendor · Creavent" }

export default function VendorPage() {
  return (
    <Container className="py-8 md:py-12">
      <PlaceholderPage title="Vendor" slice="4.5 (vendor page)" />
    </Container>
  )
}
