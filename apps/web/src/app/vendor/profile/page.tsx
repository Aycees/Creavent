import type { Metadata } from "next"

import { VendorProfileEdit } from "@/components/profile/vendor-profile-edit"

export const metadata: Metadata = { title: "Shop profile · Creavent" }

export default function VendorProfilePage() {
  return <VendorProfileEdit />
}
