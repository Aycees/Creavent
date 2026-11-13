import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"

export const metadata: Metadata = { title: "Dashboard · Creavent" }

export default function DashboardPage() {
  return <PlaceholderPage title="Dashboard" slice="2.7 (organizer dashboard) and 3.7 (dashboards)" />
}
