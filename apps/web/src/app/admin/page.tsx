import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"

export const metadata: Metadata = { title: "Overview · Creavent" }

export default function OverviewPage() {
  return <PlaceholderPage title="Overview" slice="5.3 (admin overview)" />
}
