import type { Metadata } from "next"

import { VendorApplicationsList } from "@/components/applications/vendor-application"

export const metadata: Metadata = { title: "Applications · Creavent" }

export default function ApplicationsPage() {
  return <VendorApplicationsList />
}
