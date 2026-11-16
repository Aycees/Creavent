import Link from "next/link"

import { Button } from "@/components/ui/button"

const words = {
  event: "event",
  organizer: "organizer",
  vendor: "vendor",
} as const

// Not found on a public page (mockup NotFoundPhone): the link may be old, or
// the page is no longer on Creavent (spec §7.1, §7.2).
export function NotFoundView({ what }: { what: keyof typeof words }) {
  return (
    <div className="flex max-w-[560px] flex-col items-start gap-4 py-8">
      <p className="font-mono text-mono text-muted">404</p>
      <h1 className="text-h1">We can&apos;t find this page</h1>
      <p className="text-body-lg">{`The link may be old, or this ${words[what]} page is no longer on Creavent.`}</p>
      <Button asChild>
        <Link href="/">See upcoming events</Link>
      </Button>
    </div>
  )
}
