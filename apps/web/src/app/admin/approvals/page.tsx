import type { Metadata } from "next"

import { ApprovalQueue } from "@/components/admin/approval-queue"

export const metadata: Metadata = { title: "Approvals · Admin · Creavent" }

export default function ApprovalsPage() {
  return <ApprovalQueue />
}
