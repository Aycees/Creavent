import * as React from "react"

import { cn } from "@/lib/utils"

/** `.card`: 12px radius, border, shadow-sm. Phone screens often pass `shadow-none`. */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("relative rounded-lg border bg-surface shadow-sm", className)}
      {...props}
    />
  )
}

/** `.panel`: a flat card with 24px padding, for dashboard sections. */
function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="panel"
      className={cn("rounded-lg border bg-surface p-6", className)}
      {...props}
    />
  )
}

/** `.well`: a sunken box for notes and previews. */
function Well({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="well" className={cn("rounded-md bg-sunken p-4", className)} {...props} />
}

export { Card, Panel, Well }
