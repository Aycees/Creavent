import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Container } from "@/components/ui/container"

export const metadata: Metadata = { title: "Sign up · Creavent" }

export default function SignUpPage() {
  return (
    <Container className="py-8 md:py-12">
      <PlaceholderPage title="Sign up" slice="1.3 (sign up and sign in)" />
    </Container>
  )
}
