import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Design brief §10. `brand` (ember) is for at most one conversion button per page.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-label whitespace-nowrap transition-[color,background-color,transform] duration-120 ease-out select-none active:scale-[0.97] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-sunken disabled:text-subtle [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        primary: "bg-ink text-on-inverse hover:bg-ink/90",
        brand: "bg-brand text-on-brand hover:bg-brand-hover",
        secondary: "border-border-strong bg-surface text-ink hover:bg-sunken",
        ghost: "bg-transparent text-ink hover:bg-sunken",
        danger: "bg-danger text-on-inverse hover:bg-danger/90",
        "danger-ghost": "bg-transparent text-danger-ink hover:bg-danger-soft",
      },
      size: {
        md: "h-11 px-5",
        sm: "h-9 px-3.5",
        icon: "size-11 p-0",
        "icon-sm": "size-9 p-0",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
