import type { HostApproval } from "@creavent/shared"

// Test data for the pop-up screens.
export function hostApproval(overrides: Partial<HostApproval> = {}): HostApproval {
  return {
    status: "not_submitted",
    source: null,
    submittedAt: null,
    decidedAt: null,
    rejectionReason: null,
    revoked: false,
    suspended: false,
    socialLinks: [],
    reviewedLinks: [],
    justEarned: false,
    ...overrides,
  }
}
