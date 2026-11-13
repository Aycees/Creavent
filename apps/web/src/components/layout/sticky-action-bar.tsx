import * as React from "react"

import { cn } from "@/lib/utils"

// `.sticky-bar`: the main action, fixed to the bottom of the screen on phones (design brief §14).
// Give the page enough bottom padding that the bar does not cover its last content.
export function StickyActionBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t border-border bg-surface px-4 pt-3 pb-5 shadow-up",
        className
      )}
      {...props}
    />
  )
}
