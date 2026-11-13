// PLACEHOLDER: replace in slice 1.3 (sign up and sign in) with the signed-in user from the session.
// There is no auth yet, so the signed-in layouts use these hard-coded values.

export type Role = "vendor" | "organizer"

export type ShellUser = {
  name: string
  initials: string
  roles: readonly Role[]
}

/** A vendor who also runs events, so the role switch shows. */
export const placeholderUser: ShellUser = {
  name: "Lola's Ukay",
  initials: "LU",
  roles: ["vendor", "organizer"],
}

/** Side menu counts and the organizer's approval status, keyed by menu link. */
export const placeholderCounts: Record<string, string | number> = {
  "/organizer/events": 4,
  "/organizer/approval": "Approved",
  "/admin/approvals": 7,
  "/admin/reports": 3,
}
