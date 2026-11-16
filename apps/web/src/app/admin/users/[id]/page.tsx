import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminUserDetail } from "@/components/admin/user-detail"

export const metadata: Metadata = { title: "User · Admin · Creavent" }

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AdminUserDetail userId={id} />
}

export default function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense>
      <Detail params={params} />
    </Suspense>
  )
}
