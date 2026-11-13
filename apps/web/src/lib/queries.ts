"use client"

import type { MeResponse, PublicConfig, RoleType } from "@creavent/shared"
import { useQuery } from "@tanstack/react-query"

import { api } from "./api"

export const meQueryKey = ["me"] as const

// The signed-in user, or null when signed out.
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async (): Promise<MeResponse | null> => {
      const { data, response } = await api.GET("/api/me")
      if (response.status === 401) return null
      if (!data) throw new Error(`GET /api/me failed with ${response.status}`)
      return data
    },
  })
}

export function usePublicConfig() {
  return useQuery({
    queryKey: ["public-config"],
    staleTime: Infinity,
    queryFn: async (): Promise<PublicConfig> => {
      const { data, response } = await api.GET("/api/public-config")
      if (!data) throw new Error(`GET /api/public-config failed with ${response.status}`)
      return data
    },
  })
}

// Onboarding has 4 steps per role (spec §1.1).
export const ONBOARDING_STEPS = 4

export function hasFinishedOnboarding(me: MeResponse, role: RoleType) {
  const r = me.roles.find((x) => x.role === role)
  return (r?.onboardingStep ?? 0) >= ONBOARDING_STEPS
}

// Where a signed-in user lands after logging in.
export function homePath(me: MeResponse): string {
  if (me.needsLegal) return "/account/legal"
  if (me.isAdmin) return "/admin"
  if (me.roles.length === 0) return "/onboarding"
  if (me.roles.some((r) => !hasFinishedOnboarding(me, r.role))) return "/onboarding"
  return me.roles.some((r) => r.role === "vendor") ? "/vendor" : "/organizer"
}
