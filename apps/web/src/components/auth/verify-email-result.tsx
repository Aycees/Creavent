"use client"

import type { RoleType } from "@creavent/shared"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"

// /verify-email, where the emailed link lands after the API checked it. On
// success the user is signed in and goes on to onboarding (spec §1.1).
export function VerifyEmailResult({ error, role }: { error: string | null; role: RoleType | null }) {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [sent, setSent] = React.useState(false)
  const callbackURL = role ? `/verify-email?role=${role}` : "/verify-email"

  React.useEffect(() => {
    if (!error) router.replace(`/onboarding?${role ? `role=${role}&` : ""}confirmed=1`)
  }, [error, role, router])

  if (!error) return <p className="text-body text-muted">Email confirmed. Taking you to setup…</p>

  async function resend(event: React.FormEvent) {
    event.preventDefault()
    await authClient.sendVerificationEmail({ email, callbackURL })
    setSent(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">This link has expired</h1>
      <p className="text-body text-muted">
        Confirmation links work for 24 hours and only once. Enter your email and we&apos;ll send a new one.
      </p>
      <form onSubmit={resend} className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {sent && <Alert tone="success">We sent a new link, if this email has an account waiting to be confirmed.</Alert>}
        <Button type="submit">Send a new link</Button>
      </form>
    </div>
  )
}
