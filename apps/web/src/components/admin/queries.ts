"use client"

import type { ApprovalDetail, ApprovalQueueItem } from "@creavent/shared"
import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

export const approvalQueueKey = ["admin", "approvals"] as const

export function useApprovalQueue(enabled = true) {
  return useQuery({
    queryKey: approvalQueueKey,
    enabled,
    queryFn: async (): Promise<ApprovalQueueItem[]> => {
      const { data, response } = await api.GET("/api/admin/approvals")
      if (!data) throw new Error(`GET /api/admin/approvals failed with ${response.status}`)
      return data.items
    },
  })
}

export function useApprovalDetail(userId: string) {
  return useQuery({
    queryKey: [...approvalQueueKey, userId],
    queryFn: async (): Promise<ApprovalDetail> => {
      const { data, response } = await api.GET("/api/admin/approvals/{userId}", { params: { path: { userId } } })
      if (!data) throw new Error(`GET approval failed with ${response.status}`)
      return data
    },
  })
}
