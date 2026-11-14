import type { Metadata } from "next"

import { OrganizerProfileEdit } from "@/components/profile/organizer-profile-edit"

export const metadata: Metadata = { title: "Organizer profile · Creavent" }

export default function OrganizerProfilePage() {
  return <OrganizerProfileEdit />
}
