import type { Metadata } from "next"
import { Suspense } from "react"

import { ResetPasswordScreen } from "@/components/auth/screens"

export const metadata: Metadata = { title: "Set a new password · Creavent" }

export default function Page() {
  return (
    <Suspense>
      <ResetPasswordScreen />
    </Suspense>
  )
}
