import type { MeResponse, RoleType } from "@creavent/shared"

import { ONBOARDING_STEPS } from "./queries"

export type OnboardingView =
  | { kind: "role" }
  | { kind: RoleType; step: 2 | 3 | 4 }
  | { kind: "done"; role: RoleType }

// Which onboarding screen to show (spec §1.1): the role step, then the vendor
// flow, then the organizer flow, each from where the user stopped. `wanted` is
// a role the link asks to add (?role=), for "Become a vendor" and the like.
export function onboardingView(me: MeResponse, wanted: RoleType | null): OnboardingView {
  if (me.roles.length === 0) return { kind: "role" }
  if (wanted && !me.roles.some((r) => r.role === wanted)) return { kind: "role" }
  for (const role of ["vendor", "organizer"] as const) {
    const r = me.roles.find((x) => x.role === role)
    const done = r?.onboardingStep ?? 0
    if (r && done < ONBOARDING_STEPS) return { kind: role, step: Math.max(2, done + 1) as 2 | 3 | 4 }
  }
  return { kind: "done", role: me.roles.some((r) => r.role === "organizer") ? "organizer" : "vendor" }
}
