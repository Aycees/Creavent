"use client"

import { resetPasswordSchema } from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import * as React from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { TextLink } from "@/components/ui/text-link"
import { authClient } from "@/lib/auth-client"
import { PasswordInput } from "./password-input"

function ExpiredLink() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">This link has expired</h1>
      <p className="text-body text-muted">Reset links work for 1 hour and only once. Ask for a new one.</p>
      <TextLink href="/forgot-password" className="self-start">
        Get a new link
      </TextLink>
    </div>
  )
}

// /reset-password, reached from the emailed link with ?token= (or ?error=
// when the link is no longer valid).
export function ResetPasswordForm({ token, error }: { token: string | null; error: string | null }) {
  const [state, setState] = React.useState<"form" | "done" | "expired">(token && !error ? "form" : "expired")
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "" },
  })

  async function onSubmit({ password }: { password: string }) {
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token: token ?? "" })
    setState(resetError ? "expired" : "done")
  }

  if (state === "expired") return <ExpiredLink />
  if (state === "done") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">Password changed</h1>
        <p className="text-body text-muted">Your password is changed.</p>
        <p className="text-body text-muted">We signed you out everywhere, to be safe.</p>
        <Button asChild className="self-start">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1">Set a new password</h1>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="New password" htmlFor="password" help="At least 8 characters" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
        </Field>
        <Button type="submit" block disabled={isSubmitting}>
          Set new password
        </Button>
      </form>
    </div>
  )
}
