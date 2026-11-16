"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { useMe } from "@/lib/queries"

// "Sell at these events" (spec §7.3): sign up as a vendor, or Browse events
// for someone who already sells. The one ember button on the listing.
export function SellLink() {
  const me = useMe()
  const vendor = me.data?.roles.some((r) => r.role === "vendor")
  return (
    <Button asChild variant="brand" className="max-md:w-full">
      <Link href={vendor ? "/vendor/events" : "/signup?as=vendor"}>Sell at these events</Link>
    </Button>
  )
}
