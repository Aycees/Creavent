import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

// `.fld`: label above, control, help text below (design brief §10).
// Optional fields say "(optional)" after the label; `required` says "(required)".
function Field({
  label,
  htmlFor,
  help,
  error,
  optional = false,
  required = false,
  className,
  children,
}: {
  label: React.ReactNode
  htmlFor: string
  help?: React.ReactNode
  error?: React.ReactNode
  optional?: boolean
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div data-slot="field" className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
        {required && <span className="font-normal text-muted"> (required)</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-help text-danger-ink">
          {error}
        </p>
      ) : (
        help && (
          <p id={`${htmlFor}-help`} className="text-help text-muted">
            {help}
          </p>
        )
      )}
    </div>
  )
}

/** A fixed prefix such as "+63" in a sunken box beside the input. */
function InputPrefix({
  prefix,
  className,
  children,
}: {
  prefix: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex", className)}>
      <span className="inline-flex h-11 items-center rounded-l-md border border-r-0 border-border-strong bg-sunken px-3 text-body text-muted tabular-nums">
        {prefix}
      </span>
      <div className="min-w-0 flex-1 [&_input]:rounded-l-none">{children}</div>
    </div>
  )
}

export { Field, InputPrefix }
