"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { CheckIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

// The `.check` box from the mockup: 22px, 6px radius, ink when checked.
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative grid size-[22px] shrink-0 place-items-center rounded-sm border-[1.5px] border-border-strong bg-surface text-on-inverse after:absolute after:-inset-[11px] disabled:cursor-not-allowed disabled:bg-sunken data-checked:border-ink data-checked:bg-ink",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator">
        <CheckIcon weight="bold" className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
