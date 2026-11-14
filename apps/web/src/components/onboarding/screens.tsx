"use client"

import { useSearchParams } from "next/navigation"

import { OnboardingFlow } from "./onboarding-flow"

export function OnboardingScreen() {
  const params = useSearchParams()
  const role = params.get("role")
  return (
    <OnboardingFlow
      wanted={role === "vendor" || role === "organizer" ? role : null}
      confirmed={params.get("confirmed") === "1"}
    />
  )
}
