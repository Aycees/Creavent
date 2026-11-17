import type { Metadata } from "next"

import { AdminOverview } from "@/components/admin/overview"

export const metadata: Metadata = { title: "Overview · Admin · Creavent" }

export default function OverviewPage() {
  return <AdminOverview />
}
