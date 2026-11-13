"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircleIcon, InfoIcon, WarningIcon, XCircleIcon, SpinnerIcon } from "@phosphor-icons/react"

// `.toast`: inverse fill, shadow-lg, for confirmations after an action (design brief §10).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      icons={{
        success: <CheckCircleIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <WarningIcon className="size-5" />,
        error: <XCircleIcon className="size-5" />,
        loading: <SpinnerIcon className="size-5 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--color-inverse)",
          "--normal-text": "var(--color-on-inverse)",
          "--normal-border": "var(--color-inverse)",
          "--border-radius": "var(--radius-lg)",
          "--font-family": "var(--font-sans)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "!shadow-lg !text-sm !gap-3 !px-4 !py-3.5",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
