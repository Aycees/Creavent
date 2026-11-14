"use client"

import { useMe } from "@/lib/queries"
import { toShellUser } from "@/lib/shell-user"
import { PublicHeader } from "./public-header"

// Public pages: the account menu for signed-in visitors, Log in and Sign up
// for everyone else.
export function SessionPublicHeader() {
  const { data: me } = useMe()
  return <PublicHeader user={me ? toShellUser(me) : undefined} />
}
