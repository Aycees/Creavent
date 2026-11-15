"use client"

import type { EventApplications } from "@creavent/shared"
import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

export const applicationsKey = (id: string) => ["event-applications", id] as const

// The event's applications for its organizer. Null when not found.
export function useEventApplications(id: string) {
  return useQuery({
    queryKey: applicationsKey(id),
    queryFn: async (): Promise<EventApplications | null> => {
      const { data, response } = await api.GET("/api/organizer/events/{id}/applications", { params: { path: { id } } })
      if (response.status === 404) return null
      if (!data) throw new Error(`GET /api/organizer/events/${id}/applications failed with ${response.status}`)
      return data
    },
  })
}
