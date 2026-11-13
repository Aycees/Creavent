"use client"

import type { RoleType } from "@creavent/shared"
import { useSearchParams } from "next/navigation"

import { usePublicConfig } from "@/lib/queries"
import { safeNext } from "@/lib/safe-next"
import { LoginForm } from "./login-form"
import { ResetPasswordForm } from "./reset-password-form"
import { SignUpForm } from "./sign-up-form"
import { VerifyEmailResult } from "./verify-email-result"

// Client wrappers for the sign-in pages: they read the query string, so each
// page renders them inside a Suspense boundary.

function roleParam(value: string | null): RoleType | null {
  return value === "vendor" || value === "organizer" ? value : null
}

export function SignUpScreen() {
  const params = useSearchParams()
  const config = usePublicConfig()
  return (
    <>
      <SignUpForm initialRole={roleParam(params.get("as")) ?? "vendor"} googleSignIn={config.data?.googleSignIn ?? false} />
    </>
  )
}

export function LoginScreen() {
  const params = useSearchParams()
  const config = usePublicConfig()
  return (
    <>
      <LoginForm googleSignIn={config.data?.googleSignIn ?? false} next={safeNext(params.get("next"))} />
    </>
  )
}

export function VerifyEmailScreen() {
  const params = useSearchParams()
  return <VerifyEmailResult error={params.get("error")} role={roleParam(params.get("role"))} />
}

export function ResetPasswordScreen() {
  const params = useSearchParams()
  return <ResetPasswordForm token={params.get("token")} error={params.get("error")} />
}
