import * as React from "react"
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// `.drop`: dashed box with an icon, the prompt, and the allowed types and size.
// Wraps a real file input. Upload behavior is added with the files feature.
function DropZone({
  id,
  prompt,
  hint,
  className,
  ...inputProps
}: Omit<React.ComponentProps<"input">, "type" | "prompt"> & {
  id: string
  prompt: React.ReactNode
  hint: React.ReactNode
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-[1.5px] border-dashed border-border-strong bg-canvas p-6 text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
        className
      )}
    >
      <UploadSimpleIcon aria-hidden="true" className="size-6 text-muted" />
      <span className="text-label text-ink">{prompt}</span>
      <span className="text-help text-muted">{hint}</span>
      <input id={id} type="file" className="sr-only" {...inputProps} />
    </label>
  )
}

export { DropZone }
