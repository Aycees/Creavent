"use client"

import {
  passwordSchema,
  updatePhoneSchema,
  updateProfileSchema,
  type MeResponse,
  type UpdatePhoneInput,
  type UpdateProfileInput,
} from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import * as React from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { PasswordInput } from "@/components/auth/password-input"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/ui/container"
import { Field, InputPrefix } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { meQueryKey, useMe } from "@/lib/queries"

type ApiError = { message?: string } | undefined

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = React.useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6">
      <h2 id={id} className="text-h3">
        {title}
      </h2>
      {children}
    </section>
  )
}

function ProfileForm({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient()
  const [error, setError] = React.useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema, undefined, { raw: true }),
    defaultValues: { fullName: me.fullName },
  })
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(async (body) => {
        const res = await api.PATCH("/api/me", { body })
        if (!res.data) return setError((res.error as ApiError)?.message ?? "Something went wrong. Try again.")
        queryClient.setQueryData(meQueryKey, res.data)
        toast.success("Name saved")
      })}
    >
      <Field label="Full name" htmlFor="fullName" error={formState.errors.fullName?.message}>
        <Input id="fullName" autoComplete="name" aria-invalid={!!formState.errors.fullName} {...register("fullName")} />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" variant="secondary" className="self-start" disabled={formState.isSubmitting}>
        Save
      </Button>
    </form>
  )
}

function EmailForm({ me }: { me: MeResponse }) {
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<{ newEmail: string }>({
    resolver: zodResolver(z.object({ newEmail: z.email("Enter a valid email") })),
    defaultValues: { newEmail: "" },
  })
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        You sign in with <span className="font-semibold">{me.email}</span>
      </p>
      {sentTo ? (
        <Alert tone="success">
          <span>We sent a link to {me.email} to approve the change.</span>
          <span>After that, we&apos;ll send one to {sentTo}. Your email changes when you open it.</span>
        </Alert>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={handleSubmit(async ({ newEmail }) => {
            const { error: e } = await authClient.changeEmail({ newEmail, callbackURL: "/account" })
            if (e) return setError(e.message ?? "We couldn't change your email. Try another address.")
            setSentTo(newEmail)
          })}
        >
          <Field label="New email" htmlFor="newEmail" error={formState.errors.newEmail?.message}>
            <Input id="newEmail" type="email" autoComplete="email" aria-invalid={!!formState.errors.newEmail} {...register("newEmail")} />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" variant="secondary" className="self-start" disabled={formState.isSubmitting}>
            Send confirmation link
          </Button>
        </form>
      )}
    </div>
  )
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: passwordSchema,
})

function PasswordForm({ me }: { me: MeResponse }) {
  const [state, setState] = React.useState<"idle" | "done" | "wrong">("idle")
  const { register, handleSubmit, reset, formState } = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  })
  if (!me.hasPassword) {
    return <p className="text-sm text-muted">You sign in with Google, so there&apos;s no password to change.</p>
  }
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(async (values) => {
        const { error } = await authClient.changePassword({ ...values, revokeOtherSessions: true })
        if (error) return setState("wrong")
        reset()
        setState("done")
      })}
    >
      <Field label="Current password" htmlFor="currentPassword" error={formState.errors.currentPassword?.message}>
        <PasswordInput id="currentPassword" autoComplete="current-password" {...register("currentPassword")} />
      </Field>
      <Field label="New password" htmlFor="newPassword" help="At least 8 characters" error={formState.errors.newPassword?.message}>
        <PasswordInput id="newPassword" autoComplete="new-password" {...register("newPassword")} />
      </Field>
      {state === "wrong" && <Alert tone="danger">Your current password is wrong.</Alert>}
      {state === "done" && <Alert tone="success">Password changed. We signed you out on your other devices.</Alert>}
      <Button type="submit" variant="secondary" className="self-start" disabled={formState.isSubmitting}>
        Change password
      </Button>
    </form>
  )
}

function PhoneForm({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState } = useForm<UpdatePhoneInput>({
    resolver: zodResolver(updatePhoneSchema, undefined, { raw: true }),
    defaultValues: { phone: me.phone?.replace(/^\+63/, "") ?? "" },
  })
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(async (body) => {
        const res = await api.PUT("/api/me/phone", { body })
        if (res.data) {
          queryClient.setQueryData(meQueryKey, res.data)
          toast.success("Number saved")
        }
      })}
    >
      <Field
        label="Mobile number"
        htmlFor="phone"
        help="Organizers see it on your applications, and vendors see it on your events. Never on a public page."
        error={formState.errors.phone?.message}
      >
        <InputPrefix prefix="+63">
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel-national" aria-invalid={!!formState.errors.phone} {...register("phone")} />
        </InputPrefix>
      </Field>
      <Button type="submit" variant="secondary" className="self-start" disabled={formState.isSubmitting}>
        Save
      </Button>
    </form>
  )
}

const roleNames = { vendor: "Vendor", organizer: "Organizer" } as const
const approvalNames = { not_submitted: "Not submitted", pending_review: "Pending review", approved: "Approved by Creavent", rejected: "Needs changes" } as const

function Roles({ me }: { me: MeResponse }) {
  return (
    <ul className="flex flex-col gap-3">
      {(["vendor", "organizer"] as const).map((role) => {
        const r = me.roles.find((x) => x.role === role)
        if (!r) {
          return (
            <li key={role} className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-sm text-muted">{roleNames[role]}: not added</span>
              <Button asChild variant="secondary" size="sm">
                <Link href={`/onboarding?role=${role}`}>Become {role === "vendor" ? "a vendor" : "an organizer"}</Link>
              </Button>
            </li>
          )
        }
        return (
          <li key={role} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label font-semibold">{roleNames[role]}</span>
              {r.suspended && <Badge tone="danger">Suspended</Badge>}
              {r.approvalStatus && !r.suspended && (
                <Badge tone={r.approvalStatus === "approved" ? "success" : r.approvalStatus === "rejected" ? "danger" : "neutral"}>
                  {approvalNames[r.approvalStatus]}
                </Badge>
              )}
            </div>
            {r.suspended && (
              <Alert tone="danger">
                <span>This role is suspended{r.suspensionReason ? `: ${r.suspensionReason}` : "."}</span>
                <span>Email support if you think this is a mistake.</span>
              </Alert>
            )}
            <Link href={role === "vendor" ? "/vendor" : "/organizer"} className="self-start text-sm text-ink underline underline-offset-2">
              Go to {roleNames[role].toLowerCase()} dashboard
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

// /account (sitemap §2): profile, email, password, contact number, roles.
export function AccountPage() {
  const { data: me } = useMe()
  if (!me) return <p role="status" className="p-8 text-sm text-muted">Loading…</p>
  return (
    <Container className="py-6 md:py-12">
      <div className="flex max-w-[640px] flex-col gap-4 md:gap-6">
        <h1 className="text-h1">Account</h1>
        <Section title="Profile">
          <ProfileForm me={me} />
        </Section>
        <Section title="Email">
          <EmailForm me={me} />
        </Section>
        <Section title="Password">
          <PasswordForm me={me} />
        </Section>
        <Section title="Contact number">
          <PhoneForm me={me} />
        </Section>
        <Section title="Roles">
          <Roles me={me} />
        </Section>
      </div>
    </Container>
  )
}
