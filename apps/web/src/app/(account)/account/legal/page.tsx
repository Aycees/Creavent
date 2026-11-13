import type { Metadata } from "next"

import { LegalForm } from "@/components/auth/legal-form"
import { Container } from "@/components/ui/container"

export const metadata: Metadata = { title: "Updated terms · Creavent" }

// Shown before any other page when the terms or privacy notice changed, or
// after a Google signup (spec §1).
export default function LegalPage() {
  return (
    <Container className="py-8 md:py-12">
      <div className="flex max-w-[560px] flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1">Before you continue</h1>
          <p className="text-body text-muted">
            Please read and accept the current Terms of use and Privacy notice, and confirm you are 18 or older.
          </p>
        </div>
        <LegalForm />
      </div>
    </Container>
  )
}
