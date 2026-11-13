"use client"

import { signUpSchema, type RoleType, type SignUpInput } from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarBlankIcon, StorefrontIcon } from "@phosphor-icons/react"
import Link from "next/link"
import * as React from "react"
import { useForm } from "react-hook-form"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ChoiceCard } from "@/components/ui/choice-card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { TextLink } from "@/components/ui/text-link"
import { authClient } from "@/lib/auth-client"
import { AgreementBoxes } from "./agreement-boxes"
import { CheckInbox } from "./check-inbox"
import { GoogleButton, OrDivider } from "./google-button"
import { PasswordInput } from "./password-input"

const roleChoices = [
  { role: "vendor", title: "Sell at events", sub: "Vendor account", Icon: StorefrontIcon },
  { role: "organizer", title: "Run events", sub: "Organizer account", Icon: CalendarBlankIcon },
] as const

// /signup (spec §1, flow 1). The role choice only pre-selects onboarding's
// first step and is not stored.
export function SignUpForm({ initialRole, googleSignIn }: { initialRole: RoleType; googleSignIn: boolean }) {
  const [role, setRole] = React.useState<RoleType>(initialRole)
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const [serverError, setServerError] = React.useState<"exists" | "limited" | "other" | null>(null)
  const callbackURL = `/verify-email?role=${role}`

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  })

  async function onSubmit(values: SignUpInput) {
    setServerError(null)
    // ageConfirmed and acceptLegal aren't user fields, so Better Auth's types
    // don't list them. The API refuses a signup without them (spec §1).
    const body = {
      name: values.fullName,
      email: values.email,
      password: values.password,
      ageConfirmed: true,
      acceptLegal: true,
      callbackURL,
    }
    const { error } = await authClient.signUp.email(body as Parameters<typeof authClient.signUp.email>[0])
    if (!error) return setSentTo(values.email)
    if (error.code?.startsWith("USER_ALREADY_EXISTS")) setServerError("exists")
    else if (error.status === 429) setServerError("limited")
    else setServerError("other")
  }

  if (sentTo) return <CheckInbox email={sentTo} callbackURL={callbackURL} />

  const roleLabel = role === "vendor" ? "vendor" : "organizer"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1">Create your account</h1>
        <p className="text-body text-muted">Shopping only? You can browse every event without an account.</p>
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-label">I&apos;m signing up to</legend>
        <div className="grid grid-cols-2 gap-3">
          {roleChoices.map(({ role: value, title, sub, Icon }) => (
            <ChoiceCard key={value} className="flex-col gap-3">
              <span className="flex w-full items-center justify-between">
                <Icon aria-hidden="true" className="size-6" />
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                  className="size-5 accent-ink"
                />
              </span>
              <span>
                <span className="block text-body font-semibold">{title}</span>
                <span className="block text-cap text-muted">{sub}</span>
              </span>
            </ChoiceCard>
          ))}
        </div>
        <p className="text-cap text-muted">Do both? Pick one now and add the other during setup.</p>
      </fieldset>

      {googleSignIn && (
        <>
          <GoogleButton callbackURL={`/onboarding?role=${role}`} />
          <OrDivider />
        </>
      )}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
          <Input id="fullName" autoComplete="name" aria-invalid={!!errors.fullName} {...register("fullName")} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" help="At least 8 characters" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
        </Field>

        <AgreementBoxes control={control} errors={errors} />

        {serverError === "exists" && (
          <Alert tone="danger">
            <span>
              This email already has an account. <TextLink href="/login">Log in</TextLink>
            </span>
          </Alert>
        )}
        {serverError === "limited" && <Alert tone="danger">Too many signups from here. Try again in an hour.</Alert>}
        {serverError === "other" && <Alert tone="danger">Something went wrong. Try again.</Alert>}

        <Button type="submit" variant="brand" block className="h-13 text-body" disabled={isSubmitting}>
          Create {roleLabel} account
        </Button>
        <p className="text-center text-cap text-muted">Next, we&apos;ll email you a link to confirm your address.</p>
      </form>
    </div>
  )
}

export function LogInInstead() {
  return (
    <p className="text-sm text-muted">
      Have an account?{" "}
      <Link href="/login" className="font-semibold text-ink">
        Log in
      </Link>
    </p>
  )
}
