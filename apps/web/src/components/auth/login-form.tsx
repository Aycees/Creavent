"use client"

import { signInSchema, type SignInInput } from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarBlankIcon, StorefrontIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { useForm } from "react-hook-form"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { TextLink } from "@/components/ui/text-link"
import { api } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { homePath, meQueryKey } from "@/lib/queries"
import { GoogleButton, OrDivider } from "./google-button"
import { PasswordInput } from "./password-input"

type Problem = "wrong" | "unverified" | "limited" | "other"

// /login (spec §1). `next` is a same-site path to return to after signing in.
export function LoginForm({ googleSignIn, next }: { googleSignIn: boolean; next?: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [problem, setProblem] = React.useState<Problem | null>(null)
  const [resent, setResent] = React.useState(false)
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } })

  async function onSubmit(values: SignInInput) {
    setProblem(null)
    const { error } = await authClient.signIn.email(values)
    if (error) {
      if (error.status === 401) setProblem("wrong")
      else if (error.status === 403) setProblem("unverified")
      else if (error.status === 429) setProblem("limited")
      else setProblem("other")
      return
    }
    const { data: me } = await api.GET("/api/me")
    if (!me) return setProblem("other")
    queryClient.setQueryData(meQueryKey, me)
    router.replace(me.needsLegal ? "/account/legal" : (next ?? homePath(me)))
  }

  async function resend() {
    await authClient.sendVerificationEmail({ email: getValues("email"), callbackURL: "/verify-email" })
    setResent(true)
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">Welcome back</h1>
        <p className="hidden text-body text-muted md:block">Log in to your vendor or organizer account. One login covers both.</p>
      </div>

      {googleSignIn && (
        <>
          <GoogleButton callbackURL={next ?? "/onboarding"} />
          <OrDivider />
        </>
      )}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        </Field>
        <div className="flex flex-col gap-1">
          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register("password")} />
          </Field>
          <Link href="/forgot-password" className="inline-flex min-h-11 items-center self-start text-sm text-ink underline underline-offset-2">
            Forgot password?
          </Link>
        </div>

        {problem === "wrong" && <Alert tone="danger">Wrong email or password.</Alert>}
        {problem === "unverified" && (
          <Alert tone="warning">
            <span>Confirm your email first. We sent you a link when you signed up.</span>
            {resent ? (
              <span>We sent a new link.</span>
            ) : (
              <Button type="button" variant="secondary" size="sm" className="self-start" onClick={resend}>
                Send a new link
              </Button>
            )}
          </Alert>
        )}
        {problem === "limited" && (
          <Alert tone="danger">
            <span>
              Too many tries. Wait 15 minutes, or <TextLink href="/forgot-password">reset your password</TextLink>.
            </span>
          </Alert>
        )}
        {problem === "other" && <Alert tone="danger">Something went wrong. Try again.</Alert>}

        <Button type="submit" block className="h-12 text-body" disabled={isSubmitting}>
          Log in
        </Button>
      </form>

      <div className="h-px bg-border" />
      <div className="flex flex-col gap-2.5">
        <p className="text-label">Don&apos;t have an account yet?</p>
        <div className="grid grid-cols-2 gap-2.5">
          <Button asChild variant="secondary">
            <Link href="/signup?as=vendor">
              <StorefrontIcon aria-hidden="true" className="hidden md:block" />
              Vendor account
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/signup?as=organizer">
              <CalendarBlankIcon aria-hidden="true" className="hidden md:block" />
              Organizer account
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
