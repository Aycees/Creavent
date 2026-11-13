import * as React from "react"
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// `.search`: a pill with a leading icon. Needs an aria-label or a visible label.
function SearchInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <div
      className={cn(
        "flex h-11 items-center gap-2 rounded-pill border border-border-strong bg-surface px-4 text-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
        className
      )}
    >
      <MagnifyingGlassIcon aria-hidden="true" className="size-5 flex-none" />
      <input
        type="search"
        className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-subtle"
        {...props}
      />
    </div>
  )
}

export { SearchInput }
