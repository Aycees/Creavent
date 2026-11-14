"use client"

import type { EventSetup, EventType } from "@creavent/shared"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

export const eventSetupKey = (id: string) => ["organizer-event", id] as const

// The setup state of one of the organizer's events. Null when not found.
export function useEventSetup(id: string) {
  return useQuery({
    queryKey: eventSetupKey(id),
    queryFn: async (): Promise<EventSetup | null> => {
      const { data, response } = await api.GET("/api/organizer/events/{id}", { params: { path: { id } } })
      if (response.status === 404) return null
      if (!data) throw new Error(`GET /api/organizer/events/${id} failed with ${response.status}`)
      return data
    },
  })
}

// After a save: every save answers with the whole setup state.
export function useSetupSaved(id: string) {
  const queryClient = useQueryClient()
  return (state: EventSetup) => {
    queryClient.setQueryData(eventSetupKey(id), state)
    void queryClient.invalidateQueries({ queryKey: ["organizer-events"] })
  }
}

export function useEventTypes() {
  return useQuery({
    queryKey: ["event-types"],
    staleTime: Infinity,
    queryFn: async (): Promise<EventType[]> => {
      const { data, response } = await api.GET("/api/event-types")
      if (!data) throw new Error(`GET /api/event-types failed with ${response.status}`)
      return data.eventTypes
    },
  })
}

type ErrorBody = { message?: string; details?: { path: string; message: string }[] } | undefined

// The message and field errors of a failed save.
export function saveError(error: unknown) {
  const body = error as ErrorBody
  return { message: body?.message ?? "Something went wrong. Try again.", details: body?.details ?? [] }
}
