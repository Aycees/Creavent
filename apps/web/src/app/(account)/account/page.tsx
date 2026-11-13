import type { Metadata } from "next"

import { AccountPage } from "@/components/account/account-page"

export const metadata: Metadata = { title: "Account · Creavent" }

export default function Page() {
  return <AccountPage />
}
