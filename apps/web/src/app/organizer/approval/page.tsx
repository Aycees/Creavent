import type { Metadata } from "next"

import { ApprovalStatus } from "@/components/onboarding/approval-status"

export const metadata: Metadata = { title: "Approval · Creavent" }

export default function ApprovalPage() {
  return <ApprovalStatus />
}
