import type { MeResponse, RoleType } from "@creavent/shared"
import Link from "next/link"

import { Alert } from "@/components/ui/alert"

const cannot: Record<RoleType, string> = {
  vendor: "You can't apply to events or change your slots, and your vendor page is hidden.",
  organizer: "You can't change your events or act on applications, and your organizer page is hidden.",
}

// The banner on every vendor or organizer page while that role is suspended
// (spec §2.1, mockup SuspendedVendorPhone). Pages still show; changes are refused.
export function SuspendedNotice({ me, role }: { me: MeResponse | undefined; role: RoleType }) {
  const r = me?.roles.find((x) => x.role === role)
  if (!r?.suspended) return null
  return (
    <Alert tone="danger" className="mb-6">
      <span className="flex flex-col gap-1">
        <span className="font-semibold">{`Your ${role} role is suspended`}</span>
        {r.suspensionReason && <span>&ldquo;{r.suspensionReason}&rdquo;</span>}
        <span>
          {cannot[role]}{" "}
          <Link href="/support" className="font-semibold text-inherit">
            Contact support
          </Link>
        </span>
      </span>
    </Alert>
  )
}

// A hidden event, on the organizer's event pages and the vendor's application
// page (spec §2, decided 2026-11-17). Only the organizer sees the reason.
export function HiddenEventNotice({ audience, reason }: { audience: "organizer" | "vendor"; reason?: string | null }) {
  return (
    <Alert tone="danger">
      <span className="flex flex-col gap-1">
        <span className="font-semibold">{audience === "organizer" ? "Creavent hid this event" : "Creavent hid this event while it reviews a report"}</span>
        {audience === "organizer" && reason && <span>&ldquo;{reason}&rdquo;</span>}
        <span>
          {audience === "organizer"
            ? "Visitors and vendors can't find it, and you can't edit it or act on applications until it's shown again."
            : "For now you can't release, pay for, or change your slot here. Your details stay on this page."}{" "}
          <Link href="/support" className="font-semibold text-inherit">
            Contact support
          </Link>
        </span>
      </span>
    </Alert>
  )
}
