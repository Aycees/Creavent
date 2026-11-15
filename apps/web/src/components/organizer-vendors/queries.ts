"use client"

import type { EventApplications, EventVendors } from "@creavent/shared"
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

export const vendorsKey = (id: string) => ["event-vendors", id] as const

// The event's Vendors and slots page for its organizer. Null when not found.
export function useEventVendors(id: string) {
  return useQuery({
    queryKey: vendorsKey(id),
    queryFn: async (): Promise<EventVendors | null> => {
      const { data, response } = await api.GET("/api/organizer/events/{id}/vendors", { params: { path: { id } } })
      if (response.status === 404) return null
      if (!data) throw new Error(`GET /api/organizer/events/${id}/vendors failed with ${response.status}`)
      return data
    },
  })
}

// "Fri, Nov 13 · 9 AM" in Manila time, for deadlines.
const deadlineDay = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" })
const deadlineTime = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })
export function formatDeadline(iso: string) {
  const d = new Date(iso)
  return `${deadlineDay.format(d)} · ${deadlineTime.format(d).replace(":00", "")}`
}
