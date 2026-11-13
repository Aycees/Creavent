import * as React from "react"
import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// `.ph-hdr`: 56px phone header with a back button, the page title, and optional actions.
export function PhoneHeader({
  title,
  backHref,
  backLabel = "Back",
  children,
  className,
}: {
  title: string
  backHref: string
  backLabel?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex h-14 items-center gap-2 border-b border-border bg-surface pr-2 pl-2", className)}>
      <Button asChild variant="ghost" size="icon">
        <Link href={backHref} aria-label={backLabel}>
          <ArrowLeftIcon aria-hidden="true" className="size-6" />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-h3">{title}</h1>
      {children}
    </header>
  )
}
