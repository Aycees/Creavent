import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

// Inline links are ink and underlined. Blue is reserved for info states (design brief §5).
function TextLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn("text-ink underline underline-offset-2 hover:decoration-2", className)}
      {...props}
    />
  )
}

export { TextLink }
