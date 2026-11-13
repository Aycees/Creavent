import type { Metadata } from "next"
import { Suspense } from "react"

import { SignUpScreen } from "@/components/auth/screens"

export const metadata: Metadata = { title: "Sign up · Creavent" }

export default function Page() {
  return (
    <Suspense>
      <SignUpScreen />
    </Suspense>
  )
}
