import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"

export const metadata: Metadata = { title: "User · Creavent" }

export default function UserPage() {
  return <PlaceholderPage title="User" slice="5.2 (users and events)" />
}
