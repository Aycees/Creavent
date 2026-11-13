"use client"

import { forgotPasswordSchema } from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import * as React from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { TextLink } from "@/components/ui/text-link"
import { authClient } from "@/lib/auth-client"

// /forgot-password. The reply is the same whether or not the email has an
// account, so the page can't be used to find out who has one.
export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const [limited, setLimited] = React.useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  async function onSubmit({ email }: { email: string }) {
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })
    if (error?.status === 429) return setLimited(true)
    setSentTo(email)
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">Check your inbox</h1>
        <p className="text-body text-muted">
          If {sentTo} has an account, we sent it a link to set a new password. It works for 1 hour.
        </p>
        <TextLink href="/login" className="self-start">
          Back to log in
        </TextLink>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1">Forgot your password?</h1>
        <p className="text-body text-muted">Enter your email and we&apos;ll send you a link to set a new one.</p>
      </div>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        </Field>
        {limited && <Alert tone="danger">You asked for a few links already. Try again in an hour.</Alert>}
        <Button type="submit" block disabled={isSubmitting}>
          Send reset link
        </Button>
      </form>
      <TextLink href="/login" className="self-start text-sm">
        Back to log in
      </TextLink>
    </div>
  )
}
