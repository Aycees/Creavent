import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { meQueryKey } from "@/lib/queries"
import { signedInMe } from "@/test-utils"
import { SessionPublicHeader } from "./session-public-header"

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }))
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn().mockResolvedValue({}) } }))

describe("SessionPublicHeader", () => {
  it("shows Log in and Sign up right after logging out, without a refresh", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
    client.setQueryData(meQueryKey, signedInMe)
    render(
      <QueryClientProvider client={client}>
        <SessionPublicHeader />
      </QueryClientProvider>,
    )

    await userEvent.click(screen.getByRole("button", { name: "Account menu, Maria Santos" }))
    await userEvent.click(screen.getByRole("menuitem", { name: "Log out" }))

    expect(await screen.findByRole("link", { name: "Log in" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Sign up" })).toBeInTheDocument()
  })
})
