import * as React from "react"

import { cn } from "@/lib/utils"

// 44px tall with 16px text so iOS doesn't zoom on focus (design brief §6).
const inputClass =
  "w-full min-w-0 rounded-md border border-border-strong bg-surface px-3 text-body text-ink placeholder:text-subtle disabled:cursor-not-allowed disabled:bg-sunken disabled:text-subtle aria-invalid:border-danger"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputClass, "h-11", className)}
      {...props}
    />
  )
}

export { Input, inputClass }
