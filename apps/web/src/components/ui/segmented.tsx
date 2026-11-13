import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// `.rs`: the pill used for the Vendor/Organizer role switch, List/Calendar, and the
// payment channel. Items are links or buttons; pass `asChild` to render a Next.js Link.
function Segmented({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="segmented"
      className={cn("inline-flex gap-0.5 rounded-pill bg-sunken p-1", className)}
      {...props}
    />
  )
}

function SegmentedItem({
  className,
  active = false,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="segmented-item"
      data-active={active || undefined}
      aria-current={asChild && active ? "page" : undefined}
      aria-pressed={!asChild ? active : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-pill px-4 text-label text-muted no-underline data-active:bg-surface data-active:text-ink data-active:shadow-sm [&_svg]:size-4",
        className
      )}
      {...props}
    />
  )
}

export { Segmented, SegmentedItem }
