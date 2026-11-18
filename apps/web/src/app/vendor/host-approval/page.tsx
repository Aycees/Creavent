import type { Metadata } from "next"

import { HostApprovalPage } from "@/components/popups/host-approval"

export const metadata: Metadata = { title: "Host approval · Creavent" }

export default function Page() {
  return <HostApprovalPage />
}
