import type { MeResponse, RoleType } from "@creavent/shared"

export type Role = RoleType

// What the header, menus, and role switch need about the signed-in user.
export type ShellUser = {
  name: string
  initials: string
  roles: readonly Role[]
  isAdmin?: boolean
  avatarUrl?: string | null
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?"
}

export function toShellUser(me: MeResponse): ShellUser {
  return {
    name: me.fullName,
    initials: initialsOf(me.fullName),
    roles: me.roles.map((r) => r.role),
    isAdmin: me.isAdmin,
    avatarUrl: me.avatarUrl,
  }
}
