"use client"

import type { MeResponse } from "@creavent/shared"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"

import { homePath, useMe } from "@/lib/queries"

type GateArea = "vendor" | "organizer" | "admin"

// Where a signed-in user must go instead of this page, or null to stay.
function redirectFor(me: MeResponse, pathname: string, area?: GateArea): string | null {
  if (me.needsLegal) return pathname === "/account/legal" ? null : "/account/legal"
  if (area === "admin") return me.isAdmin ? null : homePath(me)
  if (area && !me.roles.some((r) => r.role === area)) return `/onboarding?role=${area}`
  return null
}

// Signed-in pages only. The API decides who may do what; this only sends
// people to the right page: log in, accept new terms (spec §1), or add the
// role this area needs.
export function SessionGate({
  area,
  children,
}: {
  area?: GateArea
  children: (me: MeResponse) => React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: me, isPending } = useMe()
  // The query string is kept, so ?role= survives a trip through log in.
  const here = typeof window === "undefined" ? pathname : pathname + window.location.search
  const target = me ? redirectFor(me, pathname, area) : me === null ? `/login?next=${encodeURIComponent(here)}` : null

  React.useEffect(() => {
    if (target) router.replace(target)
  }, [target, router])

  if (isPending || !me || target) {
    return (
      <div role="status" className="p-8 text-sm text-muted">
        Loading…
      </div>
    )
  }
  return <>{children(me)}</>
}
