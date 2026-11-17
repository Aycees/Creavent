import type { Metadata } from "next"

import { AdminUsersList } from "@/components/admin/users-list"

export const metadata: Metadata = { title: "Users · Admin · Creavent" }

export default function UsersPage() {
  return <AdminUsersList />
}
