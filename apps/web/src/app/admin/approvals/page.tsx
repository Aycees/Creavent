import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"

export const metadata: Metadata = { title: "Approvals · Creavent" }

export default function ApprovalsPage() {
  return <PlaceholderPage title="Approvals" slice="1.7 (admin approvals)" />
}
