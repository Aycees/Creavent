"use client"

import type { ApplicationDetail, ApplicationFilter, OrganizerApplications } from "@creavent/shared"
import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

export function useOrganizerApplications(query: { status: ApplicationFilter; eventId?: string; q?: string }) {
  return useQuery({
    queryKey: ["organizer-applications", query],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<OrganizerApplications> => {
      const { data, response } = await api.GET("/api/organizer/applications", { params: { query } })
      if (!data) throw new Error(`GET /api/organizer/applications failed with ${response.status}`)
      return data
    },
  })
}

export function useApplicationDetail(id: string) {
  return useQuery({
    queryKey: ["organizer-application", id],
    queryFn: async (): Promise<ApplicationDetail | null> => {
      const { data, response } = await api.GET("/api/organizer/applications/{id}", { params: { path: { id } } })
      if (response.status === 404) return null
      if (!data) throw new Error(`GET /api/organizer/applications/${id} failed with ${response.status}`)
      return data
    },
  })
}

// The side menu's waiting count (decided 2026-11-15).
export function useWaitingCount(enabled: boolean) {
  return useQuery({
    queryKey: ["organizer-applications-count"],
    enabled,
    queryFn: async (): Promise<number> => {
      const { data } = await api.GET("/api/organizer/applications/count")
      return data?.waiting ?? 0
    },
  })
}

const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" })
export const manilaDay = (iso: string) => dayFormat.format(new Date(iso))

// "Waiting 5 days", "Waiting since today".
export function waitingFor(iso: string, now: number) {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000)
  if (days < 1) return "Waiting since today"
  return `Waiting ${days} day${days === 1 ? "" : "s"}`
}

// "5 days ago", "today".
export function ago(iso: string, now: number) {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000)
  return days < 1 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`
}
