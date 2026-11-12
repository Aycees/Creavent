import { Container } from "@/components/ui/container"
import { Logo } from "@/components/ui/logo"

// Placeholder until the event listing (sitemap: /) is built.
export default function Home() {
  return (
    <Container className="flex flex-col gap-4 py-16">
      <Logo />
      <p className="text-muted">The event listing will live here.</p>
    </Container>
  )
}
