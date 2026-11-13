import type { Metadata } from "next"
import { Suspense } from "react"

import { OnboardingScreen } from "@/components/onboarding/screens"

export const metadata: Metadata = { title: "Set up your account · Creavent" }

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingScreen />
    </Suspense>
  )
}
