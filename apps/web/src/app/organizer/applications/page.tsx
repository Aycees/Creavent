import type { Metadata } from "next"
import { Suspense } from "react"

import { OrganizerApplicationsPage } from "@/components/organizer-applications/applications-page"

export const metadata: Metadata = { title: "Applications · Creavent" }

// In Suspense: the page reads the time ("Waiting 5 days"), which can't be
// prerendered.
export default function ApplicationsRoute() {
  return (
    <Suspense>
      <OrganizerApplicationsPage />
    </Suspense>
  )
}
