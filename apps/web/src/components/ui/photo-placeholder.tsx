import * as React from "react"
import { ImageIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// `.ph`: shown when there's no photo yet. 16:9 by default, 3:2 for the detail page cover.
function PhotoPlaceholder({
  ratio = "16/9",
  label,
  icon,
  className,
}: {
  ratio?: "16/9" | "3/2" | "4/3" | "1/1"
  label?: string
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div
      style={{ aspectRatio: ratio }}
      className={cn("relative grid place-items-center overflow-hidden bg-sunken text-subtle", className)}
    >
      {icon ?? <ImageIcon aria-hidden="true" className="size-8" />}
      {label && <span className="absolute bottom-2.5 left-3 text-cap text-subtle">{label}</span>}
    </div>
  )
}

export { PhotoPlaceholder }
