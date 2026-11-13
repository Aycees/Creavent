import * as React from "react"

import { cn } from "@/lib/utils"

// `.opt`: a large tappable card around a real radio or checkbox (role pick,
// signup choice, "Paid with"). It gets the 2px ink border when its control is checked.
function ChoiceCard({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="choice-card"
      className={cn(
        "flex cursor-pointer items-start gap-3.5 rounded-lg border border-border-strong bg-surface p-4 has-data-[state=checked]:border-2 has-data-[state=checked]:border-ink has-data-[state=checked]:p-[15px] has-checked:border-2 has-checked:border-ink has-checked:p-[15px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
        className
      )}
      {...props}
    />
  )
}

export { ChoiceCard }
