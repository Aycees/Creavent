import type { Metadata } from "next"
import { Suspense } from "react"

import { VerifyEmailScreen } from "@/components/auth/screens"

export const metadata: Metadata = { title: "Confirm your email · Creavent" }

export default function Page() {
  return (
    <Suspense>
      <VerifyEmailScreen />
    </Suspense>
  )
}
