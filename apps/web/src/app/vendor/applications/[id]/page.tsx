import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/layout/placeholder-page"

export const metadata: Metadata = { title: "Application · Creavent" }

export default function ApplicationPage() {
  return <PlaceholderPage title="Application" slice="3.4 (vendor application page)" />
}
