import type { Metadata } from "next"
import { Suspense } from "react"

import { ReportReview } from "@/components/admin/report-review"

export const metadata: Metadata = { title: "Report · Admin · Creavent" }

async function Review({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ReportReview reportId={id} />
}

export default function ReportPage({ params }: PageProps<"/admin/reports/[id]">) {
  return (
    <Suspense>
      <Review params={params} />
    </Suspense>
  )
}
