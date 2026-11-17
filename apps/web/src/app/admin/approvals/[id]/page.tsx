import type { Metadata } from "next"
import { Suspense } from "react"

import { ApprovalReview } from "@/components/admin/approval-review"

export const metadata: Metadata = { title: "Approval · Admin · Creavent" }

async function Review({ params, searchParams }: PageProps<"/admin/approvals/[id]">) {
  const [{ id }, { kind }] = await Promise.all([params, searchParams])
  return <ApprovalReview userId={id} kind={kind === "host" ? "host" : "organizer"} />
}

export default function ApprovalPage(props: PageProps<"/admin/approvals/[id]">) {
  return (
    <Suspense>
      <Review {...props} />
    </Suspense>
  )
}
