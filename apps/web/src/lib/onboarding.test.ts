import type { MeResponse } from "@creavent/shared"
import { describe, expect, it } from "vitest"

import { onboardingView } from "./onboarding"

function me(roles: Array<[role: "vendor" | "organizer", step: number | null]>): MeResponse {
  return {
    id: "8d4a7f3e-1b2c-4d5e-8f90-123456789abc",
    fullName: "Maria Santos",
    email: "maria@example.com",
    phone: null,
    avatarUrl: null,
    isAdmin: false,
    needsLegal: false,
    hasPassword: true,
    roles: roles.map(([role, onboardingStep]) => ({
      role,
      onboardingStep,
      approvalStatus: role === "organizer" ? "not_submitted" : null,
      rejectionReason: null,
      suspended: false,
      suspensionReason: null,
    })),
  }
}

describe("onboardingView", () => {
  it("starts with the role step when the user has no role", () => {
    expect(onboardingView(me([]), null)).toEqual({ kind: "role" })
  })

  it("continues a vendor from the step after the last one they finished", () => {
    expect(onboardingView(me([["vendor", 1]]), null)).toEqual({ kind: "vendor", step: 2 })
    expect(onboardingView(me([["vendor", 3]]), null)).toEqual({ kind: "vendor", step: 4 })
  })

  it("runs the vendor flow first, then the organizer flow, for both roles", () => {
    expect(onboardingView(me([["vendor", 2], ["organizer", 1]]), null)).toEqual({ kind: "vendor", step: 3 })
    expect(onboardingView(me([["vendor", 4], ["organizer", 1]]), null)).toEqual({ kind: "organizer", step: 2 })
  })

  it("shows the done screen of the last flow when everything is finished", () => {
    expect(onboardingView(me([["vendor", 4]]), null)).toEqual({ kind: "done", role: "vendor" })
    expect(onboardingView(me([["vendor", 4], ["organizer", 4]]), null)).toEqual({ kind: "done", role: "organizer" })
  })

  it("asks for the role again when the link asks to add a role the user doesn't have", () => {
    expect(onboardingView(me([["vendor", 4]]), "organizer")).toEqual({ kind: "role" })
    expect(onboardingView(me([["vendor", 4]]), "vendor")).toEqual({ kind: "done", role: "vendor" })
  })
})
