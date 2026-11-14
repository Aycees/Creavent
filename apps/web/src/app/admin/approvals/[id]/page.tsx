import type { Metadata } from "next"
import { Suspense } from "react"

import { ApprovalReview } from "@/components/admin/approval-review"

export const metadata: Metadata = { title: "Approval · Admin · Creavent" }

async function Review({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ApprovalReview userId={id} />
}

export default function ApprovalPage({ params }: PageProps<"/admin/approvals/[id]">) {
  return (
    <Suspense>
      <Review params={params} />
    </Suspense>
  )
}
