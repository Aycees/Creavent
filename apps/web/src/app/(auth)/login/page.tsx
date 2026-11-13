import type { Metadata } from "next"
import { Suspense } from "react"

import { LoginScreen } from "@/components/auth/screens"

export const metadata: Metadata = { title: "Log in · Creavent" }

export default function Page() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  )
}
