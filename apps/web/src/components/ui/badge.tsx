import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Status badges (design brief §5.1). The same status always uses the same tone.
// Statuses get a leading dot; tags and facts ("Flea market", "3 days") use dot={false}.
const badgeVariants = cva(
  "inline-flex h-6 items-center gap-1.5 rounded-xs px-2 text-cap whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-sunken text-muted [--dot:var(--color-subtle)]",
        info: "bg-info-soft text-info-ink [--dot:var(--color-info)]",
        success: "bg-success-soft text-success-ink [--dot:var(--color-success)]",
        warning: "bg-warning-soft text-warning-ink [--dot:var(--color-warning)]",
        danger: "bg-danger-soft text-danger-ink [--dot:var(--color-danger)]",
        ink: "bg-inverse text-on-inverse [--dot:var(--color-on-inverse)]",
        today: "bg-brand-soft text-brand-ink [--dot:var(--color-brand)]",
      },
      dot: {
        true: "before:size-1.5 before:rounded-pill before:bg-(--dot) before:content-['']",
        false: "",
      },
    },
    defaultVariants: { tone: "neutral", dot: true },
  }
)

function Badge({
  className,
  tone,
  dot,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone, dot }), className)} {...props} />
}

/** `.tag`: categories on vendor and organizer profiles. */
function Tag({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tag"
      className={cn(
        "inline-flex h-7 items-center rounded-sm bg-sunken px-2.5 text-[13px] leading-5 font-medium whitespace-nowrap text-ink",
        className
      )}
      {...props}
    />
  )
}

export { Badge, Tag, badgeVariants }
