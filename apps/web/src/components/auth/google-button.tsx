"use client"

import { GoogleLogoIcon } from "@phosphor-icons/react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

// Starts Google sign-in. A new Google account lands on callbackURL; an
// existing one opens the same account (spec §1).
export function GoogleButton({ callbackURL }: { callbackURL: string }) {
  const [pending, setPending] = React.useState(false)
  return (
    <Button
      type="button"
      variant="secondary"
      block
      className="h-12"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        await authClient.signIn.social({ provider: "google", callbackURL })
        setPending(false)
      }}
    >
      <GoogleLogoIcon aria-hidden="true" weight="bold" />
      Continue with Google
    </Button>
  )
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-cap text-muted">or with email</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
