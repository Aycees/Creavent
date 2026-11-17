import * as React from "react"

import { cn } from "@/lib/utils"

// `.chip`: filter chips. `pressed` gives the inverse fill and sets aria-pressed.
function Chip({
  className,
  pressed = false,
  count,
  children,
  ...props
}: React.ComponentProps<"button"> & { pressed?: boolean; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-slot="chip"
      className={cn(
        "group/chip inline-flex h-11 shrink-0 items-center gap-1.5 rounded-pill border border-border-strong bg-surface px-4 text-label whitespace-nowrap text-ink transition-[color,background-color,border-color,transform] duration-120 ease-out active:scale-[0.97] aria-pressed:border-inverse aria-pressed:bg-inverse aria-pressed:text-on-inverse md:h-10",
        className
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className="text-muted tabular-nums group-aria-pressed/chip:text-on-inverse-muted">
          {count}
        </span>
      )}
    </button>
  )
}

export { Chip }
