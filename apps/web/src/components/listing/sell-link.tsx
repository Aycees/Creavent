"use client"

import Link from "next/link"
import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import { useMe } from "@/lib/queries"

// "Sell at these events" (spec §7.3): sign up as a vendor, or Browse events
// for someone who already sells. The one ember button on the listing.
const noSubscribe = () => () => {}

export function SellLink() {
  const me = useMe()
  // The page is cached and served signed-out, so the first client render must match
  // that HTML even when the query cache already knows the user.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false)
  const vendor = hydrated && me.data?.roles.some((r) => r.role === "vendor")
  return (
    <Button asChild variant="brand" className="max-md:w-full">
      <Link href={vendor ? "/vendor/events" : "/signup?as=vendor"}>Sell at these events</Link>
    </Button>
  )
}
