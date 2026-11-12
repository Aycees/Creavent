"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Avatar as AvatarPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// `.avatar`, `.av-lg`, `.av-xl`: initials on sunken, or the uploaded photo, in a circle.
const avatarVariants = cva(
  "relative inline-flex shrink-0 overflow-hidden rounded-pill bg-sunken font-semibold text-ink select-none",
  {
    variants: {
      size: {
        md: "size-9 text-[13px]",
        lg: "size-14 text-[18px]",
        xl: "size-22 text-[28px]",
      },
    },
    defaultVariants: { size: "md" },
  }
)

function Avatar({
  className,
  size,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & VariantProps<typeof avatarVariants>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(avatarVariants({ size }), className)}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn("grid size-full place-items-center", className)}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
