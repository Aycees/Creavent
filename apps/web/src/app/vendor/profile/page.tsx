import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"

export const metadata: Metadata = { title: "Profile · Creavent" }

export default function ProfilePage() {
  return <PlaceholderPage title="Profile" slice="1.5 (vendor onboarding)" />
}
