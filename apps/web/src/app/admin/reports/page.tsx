import type { Metadata } from "next"

import { ReportsQueue } from "@/components/admin/reports-queue"

export const metadata: Metadata = { title: "Reports · Admin · Creavent" }

export default function ReportsPage() {
  return <ReportsQueue />
}
