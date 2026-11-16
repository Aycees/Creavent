"use client"

import type { AdminSearchResult, ApprovalDetail, ApprovalQueueItem, ReportDetail } from "@creavent/shared"
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

export const reportsKey = ["admin", "reports"] as const

export function useReportGroups(status: "open" | "resolved", enabled = true) {
  return useQuery({
    queryKey: [...reportsKey, "list", status],
    enabled,
    queryFn: async () => {
      const { data, response } = await api.GET("/api/admin/reports", { params: { query: { status } } })
      if (!data) throw new Error(`GET /api/admin/reports failed with ${response.status}`)
      return data
    },
  })
}

export function useReportDetail(id: string) {
  return useQuery({
    queryKey: [...reportsKey, id],
    queryFn: async (): Promise<ReportDetail> => {
      const { data, response } = await api.GET("/api/admin/reports/{id}", { params: { path: { id } } })
      if (!data) throw new Error(`GET report failed with ${response.status}`)
      return data
    },
  })
}

export function useAdminSearch(q: string) {
  const term = q.trim()
  return useQuery({
    queryKey: ["admin", "search", term],
    enabled: term.length > 0,
    queryFn: async (): Promise<AdminSearchResult> => {
      const { data, response } = await api.GET("/api/admin/search", { params: { query: { q: term } } })
      if (!data) throw new Error(`GET /api/admin/search failed with ${response.status}`)
      return data
    },
  })
}
