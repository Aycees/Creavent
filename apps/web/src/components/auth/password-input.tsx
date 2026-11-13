"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// A password field with a Show button inside it, as in the mockup.
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false)
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-20", className)} {...props} />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute top-1 right-1"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? "Hide" : "Show"}
      </Button>
    </div>
  )
}
