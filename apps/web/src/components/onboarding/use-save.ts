"use client"

import type { OnboardingState } from "@creavent/shared"
import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"

import { meQueryKey } from "@/lib/queries"

export const onboardingQueryKey = ["onboarding"] as const

// Called after any step saves, so the flow can leave a step the user went
// back to.
export const StepSavedContext = React.createContext<() => void>(() => {})

type Result = { data?: OnboardingState; error?: unknown }

// Saves a step: the API answers with the whole onboarding state, and /api/me
// is refetched because it holds each role's furthest step.
export function useSave() {
  const onSaved = React.useContext(StepSavedContext)
  const queryClient = useQueryClient()
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  async function save(request: Promise<Result>) {
    setError(null)
    setSaving(true)
    try {
      const { data, error: apiError } = await request
      if (!data) {
        setError((apiError as { message?: string } | undefined)?.message ?? "Something went wrong. Try again.")
        return false
      }
      queryClient.setQueryData(onboardingQueryKey, data)
      await queryClient.invalidateQueries({ queryKey: meQueryKey })
      onSaved()
      return true
    } finally {
      setSaving(false)
    }
  }

  return { save, error, saving }
}
