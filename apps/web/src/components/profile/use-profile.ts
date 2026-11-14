"use client"

import type { OnboardingState } from "@creavent/shared"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { meQueryKey } from "@/lib/queries"
import { onboardingQueryKey } from "@/components/onboarding/use-save"

export const profileQueryKey = ["profile"] as const

// The signed-in user's vendor and organizer profiles.
export function useProfile() {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: async (): Promise<OnboardingState> => {
      const { data, response } = await api.GET("/api/profile")
      if (!data) throw new Error(`GET /api/profile failed with ${response.status}`)
      return data
    },
  })
}

// After a save: the answer is the new state, and /api/me may have changed
// (avatar, approval status).
export function useProfileSaved() {
  const queryClient = useQueryClient()
  return async (state: OnboardingState) => {
    queryClient.setQueryData(profileQueryKey, state)
    queryClient.setQueryData(onboardingQueryKey, state)
    await queryClient.invalidateQueries({ queryKey: meQueryKey })
  }
}
