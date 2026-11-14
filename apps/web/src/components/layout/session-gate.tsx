"use client"

import type { MeResponse } from "@creavent/shared"
import { useRouter } from "next/navigation"
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
//
// The page is always rendered, and only hidden until the session is checked,
// so Next.js can prerender it and check it for instant navigation. The URL is
// read from window once the session has loaded (in the browser only), so no
// URL hook needs a Suspense boundary.
export function SessionGate({
  area,
  children,
}: {
  area?: GateArea
  children: (me: MeResponse | undefined) => React.ReactNode
}) {
  const router = useRouter()
  const { data: me } = useMe()
  let target: string | null = null
  if (me === null) {
    // The query string is kept, so ?role= survives a trip through log in.
    target = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
  } else if (me) {
    target = redirectFor(me, window.location.pathname, area)
  }
  const ready = Boolean(me) && !target

  React.useEffect(() => {
    if (target) router.replace(target)
  }, [target, router])

  return (
    <>
      {!ready && (
        <div role="status" className="p-8 text-sm text-muted">
          Loading…
        </div>
      )}
      <div hidden={!ready} className="contents">
        {children(me ?? undefined)}
      </div>
    </>
  )
}
