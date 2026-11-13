"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import * as React from "react"

// TanStack Query for signed-in screens (docs/architecture.md §8). Screens
// refetch when the tab regains focus, which is the MVP's live update (§6.3).
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } })
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
