import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// `.slot` tiles. States differ in lightness and border style, not hue alone,
// and each tile also carries its state in hidden text.
const slotVariants = cva(
  "grid h-12 place-items-center rounded-xs border-[1.5px] font-mono text-[12px] font-medium",
  {
    variants: {
      state: {
        open: "border-dashed border-border-strong bg-surface text-muted",
        assigned: "border-border-strong bg-sunken text-ink",
        reserved: "border-inverse bg-inverse text-on-inverse",
        due: "border-warning bg-warning-soft text-warning-ink",
      },
    },
    defaultVariants: { state: "open" },
  }
)

const stateLabel = {
  open: "open",
  assigned: "assigned",
  reserved: "reserved",
  due: "payment due",
} as const

function SlotTile({
  code,
  state,
  className,
}: { code: string; className?: string } & VariantProps<typeof slotVariants>) {
  return (
    <span data-slot="slot-tile" className={cn(slotVariants({ state }), className)}>
      {code}
      <span className="sr-only">, {stateLabel[state ?? "open"]}</span>
    </span>
  )
}

function SlotGrid({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2", className)}
      {...props}
    />
  )
}

export { SlotTile, SlotGrid }
