import Link from "next/link"

import { cn } from "@/lib/utils"

// "Approved by Creavent" seal for organizers (design brief §10). Never say "verified".
// `compact` shows "Approved" for tight panels; `sealOnly` for the smallest cards.
// Pass `link={false}` when the mark sits inside another link.
function ApprovedMark({
  compact = false,
  sealOnly = false,
  link = true,
  className,
}: {
  compact?: boolean
  sealOnly?: boolean
  link?: boolean
  className?: string
}) {
  const label = compact ? "Approved" : "Approved by Creavent"
  const content = (
    <>
      <span
        aria-hidden="true"
        className="grid size-4 flex-none place-items-center rounded-pill bg-info"
      >
        <svg viewBox="0 0 12 12" className="size-2.5 fill-none stroke-on-inverse stroke-[2.4] [stroke-linecap:round] [stroke-linejoin:round]">
          <path d="M3 6.2l2 2 4-4.4" />
        </svg>
      </span>
      {sealOnly ? <span className="sr-only">Approved by Creavent</span> : label}
    </>
  )
  const classes = cn(
    "inline-flex items-center gap-1.5 text-[13px] leading-5 font-medium text-info-ink no-underline",
    className
  )

  if (link) {
    return (
      <Link href="/approved" className={classes} title={sealOnly ? "Approved by Creavent" : undefined}>
        {content}
      </Link>
    )
  }
  return (
    <span className={classes} title={sealOnly ? "Approved by Creavent" : undefined}>
      {content}
    </span>
  )
}

export { ApprovedMark }
