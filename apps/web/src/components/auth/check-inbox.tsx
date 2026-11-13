"use client"

import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

// After signup, or when a verification link expired: the link is on its way,
// with a way to send it again.
export function CheckInbox({ email, callbackURL }: { email: string; callbackURL: string }) {
  const [state, setState] = React.useState<"idle" | "sending" | "sent" | "limited">("idle")

  async function resend() {
    setState("sending")
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL })
    setState(error?.status === 429 ? "limited" : "sent")
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">Check your inbox</h1>
      <p className="text-body text-muted">
        We sent a link to <span className="font-semibold text-ink">{email}</span>. Open it to confirm your email and
        set up your account. It works for 24 hours.
      </p>
      <p className="text-sm text-muted">
        Can&apos;t find it? Check your spam folder. If the address is wrong, sign up again with the right one.
      </p>
      {state === "sent" && <Alert tone="success">We sent a new link.</Alert>}
      {state === "limited" && <Alert tone="warning">You asked for a few links already. Wait a while and try again.</Alert>}
      <Button type="button" variant="secondary" onClick={resend} disabled={state === "sending"}>
        Send the link again
      </Button>
    </div>
  )
}
