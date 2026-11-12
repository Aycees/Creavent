import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { CheckCircleIcon, InfoIcon, WarningIcon, XCircleIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// `.alert`: icon plus one or two sentences. A state is never shown by color alone.
const alertVariants = cva("flex items-start gap-3 rounded-md px-4 py-3 text-sm", {
  variants: {
    tone: {
      info: "bg-info-soft text-info-ink",
      success: "bg-success-soft text-success-ink",
      warning: "bg-warning-soft text-warning-ink",
      danger: "bg-danger-soft text-danger-ink",
    },
  },
  defaultVariants: { tone: "info" },
})

const icons = {
  info: InfoIcon,
  success: CheckCircleIcon,
  warning: WarningIcon,
  danger: XCircleIcon,
}

function Alert({
  className,
  tone,
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  const Icon = icons[tone ?? "info"]
  return (
    <div
      data-slot="alert"
      role={tone === "danger" ? "alert" : "status"}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      <Icon aria-hidden="true" className="size-5 flex-none" />
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
    </div>
  )
}

export { Alert }
