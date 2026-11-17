"use client"

import { formatDay, manilaParts, type HostApproval, type Popup, type PopupSummary, type Popups } from "@creavent/shared"
import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

export const popupsKey = ["vendor", "popups"] as const
export const hostApprovalKey = ["vendor", "host-approval"] as const

// "Thu, Nov 12" for a moment in Manila.
export function manilaDay(iso: string) {
  return formatDay(manilaParts(new Date(iso)).date)
}

export function useHostApproval() {
  return useQuery({
    queryKey: hostApprovalKey,
    queryFn: async (): Promise<HostApproval> => {
      const { data, response } = await api.GET("/api/vendor/host-approval")
      if (!data) throw new Error(`GET /api/vendor/host-approval failed with ${response.status}`)
      return data
    },
  })
}

// My pop-ups. Opening it checks the earned route (spec §4.7).
export function usePopups() {
  return useQuery({
    queryKey: popupsKey,
    queryFn: async (): Promise<Popups> => {
      const { data, response } = await api.GET("/api/vendor/popups")
      if (!data) throw new Error(`GET /api/vendor/popups failed with ${response.status}`)
      return data
    },
  })
}

export function usePopupSummary() {
  return useQuery({
    queryKey: [...popupsKey, "summary"],
    queryFn: async (): Promise<PopupSummary> => {
      const { data, response } = await api.GET("/api/vendor/popups/summary")
      if (!data) throw new Error(`GET /api/vendor/popups/summary failed with ${response.status}`)
      return data
    },
  })
}

export function usePopup(id: string) {
  return useQuery({
    queryKey: [...popupsKey, id],
    queryFn: async (): Promise<Popup> => {
      const { data, response } = await api.GET("/api/vendor/popups/{id}", { params: { path: { id } } })
      if (!data) throw new Error(`GET pop-up failed with ${response.status}`)
      return data
    },
  })
}
