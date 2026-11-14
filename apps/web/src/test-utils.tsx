import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import type * as React from "react"

// Renders with a fresh query client, as the app's QueryProvider does.
export function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

export const signedInMe = {
  id: "8d4a7f3e-1b2c-4d5e-8f90-123456789abc",
  fullName: "Maria Santos",
  email: "maria@example.com",
  phone: null,
  avatarUrl: null,
  isAdmin: false,
  needsLegal: false,
  hasPassword: true,
  roles: [],
}
