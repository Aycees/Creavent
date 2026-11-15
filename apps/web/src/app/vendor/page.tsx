import type { Metadata } from "next"

import { VendorDashboardPage } from "@/components/applications/vendor-dashboard"

export const metadata: Metadata = { title: "Dashboard · Creavent" }

export default function DashboardPage() {
  return <VendorDashboardPage />
}
