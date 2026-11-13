import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"

export const metadata: Metadata = { title: "Users · Creavent" }

export default function UsersPage() {
  return <PlaceholderPage title="Users" slice="5.2 (users and events)" />
}
