"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Underline tabs with a 2px ink indicator (design brief §10). Scrolls sideways on phones.
function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-6", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      {...props}
    />
  )
}

const tabTriggerClass =
  "inline-flex h-11 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-label whitespace-nowrap text-muted hover:text-ink disabled:cursor-not-allowed disabled:text-subtle data-active:border-ink data-active:text-ink [&_svg]:size-4"

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabTriggerClass, className)}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  )
}

/** A count shown inside a tab, as in "Applications 12". */
function TabCount({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("text-cap font-normal text-muted tabular-nums", className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabCount, tabTriggerClass }
