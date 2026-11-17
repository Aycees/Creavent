"use client"

import type {
  AdminEvent,
  AdminEvents,
  AdminEventsFilter,
  AdminSearchResult,
  AdminUser,
  AdminUsers,
  AdminUsersFilter,
  ApprovalDetail,
  ApprovalKind,
  ApprovalQueueItem,
  ReportDetail,
} from "@creavent/shared"
import { keepPreviousData, useQuery } from "@tanstack/react-query"

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

// Where an approval request is reviewed: a pop-up host request on the vendor
// role, or an organizer request (spec §4.7).
export function approvalHref(userId: string, kind: ApprovalKind) {
  return kind === "host" ? `/admin/approvals/${userId}?kind=host` : `/admin/approvals/${userId}`
}

export function useApprovalDetail(userId: string, kind: ApprovalKind = "organizer") {
  return useQuery({
    queryKey: [...approvalQueueKey, kind, userId],
    queryFn: async (): Promise<ApprovalDetail> => {
      const path = kind === "host" ? "/api/admin/approvals/hosts/{userId}" : "/api/admin/approvals/{userId}"
      const { data, response } = await api.GET(path, { params: { path: { userId } } })
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

export const adminUsersKey = ["admin", "users"] as const
export const adminEventsKey = ["admin", "events"] as const

export function useAdminUsers(query: { q?: string; filter: AdminUsersFilter; page: number }) {
  return useQuery({
    queryKey: [...adminUsersKey, "list", query],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<AdminUsers> => {
      const { data, response } = await api.GET("/api/admin/users", { params: { query } })
      if (!data) throw new Error(`GET /api/admin/users failed with ${response.status}`)
      return data
    },
  })
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: [...adminUsersKey, id],
    queryFn: async (): Promise<AdminUser> => {
      const { data, response } = await api.GET("/api/admin/users/{id}", { params: { path: { id } } })
      if (!data) throw new Error(`GET user failed with ${response.status}`)
      return data
    },
  })
}

export function useAdminEvents(query: { q?: string; filter: AdminEventsFilter; page: number }) {
  return useQuery({
    queryKey: [...adminEventsKey, "list", query],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<AdminEvents> => {
      const { data, response } = await api.GET("/api/admin/events", { params: { query } })
      if (!data) throw new Error(`GET /api/admin/events failed with ${response.status}`)
      return data
    },
  })
}

export function useAdminEvent(id: string) {
  return useQuery({
    queryKey: [...adminEventsKey, id],
    queryFn: async (): Promise<AdminEvent> => {
      const { data, response } = await api.GET("/api/admin/events/{id}", { params: { path: { id } } })
      if (!data) throw new Error(`GET event failed with ${response.status}`)
      return data
    },
  })
}
