"use client"

import { createAuthClient } from "better-auth/react"

// Better Auth's browser client. It calls /api/auth/* on this site, which
// Next.js forwards to the API (docs/architecture.md §4.3).
export const authClient = createAuthClient({ basePath: "/api/auth" })
