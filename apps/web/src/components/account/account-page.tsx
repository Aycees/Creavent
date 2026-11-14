"use client"

import { passwordSchema, phoneSchema, type AccountDetails, type MeResponse } from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarBlankIcon, EnvelopeSimpleIcon, StorefrontIcon } from "@phosphor-icons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import * as React from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { PasswordInput } from "@/components/auth/password-input"
import { PictureEditor } from "@/components/profile/parts"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/ui/container"
import { Field, InputPrefix } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { meQueryKey, useMe, usePublicConfig } from "@/lib/queries"
import { initialsOf } from "@/lib/shell-user"
import { useUpload } from "@/lib/use-upload"
import { cn } from "@/lib/utils"

type ApiError = { message?: string } | undefined

const day = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" })
const monthYear = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", year: "numeric" })

const sections = [
  ["me", "Personal details"],
  ["signin", "Email and sign-in"],
  ["roles", "Roles"],
  ["legal", "Terms and privacy"],
] as const

function useAccountDetails() {
  return useQuery({
    queryKey: ["account"],
    queryFn: async (): Promise<AccountDetails> => {
      const { data, response } = await api.GET("/api/account")
      if (!data) throw new Error(`GET /api/account failed with ${response.status}`)
      return data
    },
  })
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-6 flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-h3">
          {title}
        </h2>
        {intro && <p className="text-sm text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

// One line of the sign-in section: a label, its value, and an action.
function Row({ label, children, action, last }: { label: string; children: React.ReactNode; action?: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", !last && "border-b border-border pb-4")}>
      <div className="min-w-0 flex-1 basis-60">
        <p className="text-label">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
      {action}
    </div>
  )
}

const detailsSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name").max(100),
  phone: z.union([z.literal(""), phoneSchema]),
})

function PersonalDetails({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient()
  const upload = useUpload("avatar")
  const [error, setError] = React.useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<z.input<typeof detailsSchema>>({
    resolver: zodResolver(detailsSchema, undefined, { raw: true }),
    defaultValues: { fullName: me.fullName, phone: me.phone?.replace(/^\+63/, "") ?? "" },
  })

  async function setAvatar(avatarFileId: string | null) {
    const res = await api.PUT("/api/me/avatar", { body: { avatarFileId } })
    if (res.data) queryClient.setQueryData(meQueryKey, res.data)
  }

  return (
    <Section id="me" title="Personal details">
      <PictureEditor
        round
        title="Profile picture"
        intro="Also used as your shop picture."
        hint="Square, at least 256 × 256 px, JPEG, PNG or WebP up to 5 MB."
        url={me.avatarUrl}
        fallback={initialsOf(me.fullName)}
        pending={upload.pending}
        error={upload.error}
        onPick={async (file) => {
          const done = await upload.upload(file)
          if (done) await setAvatar(done.id)
        }}
        onRemove={() => setAvatar(null)}
      />
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async ({ fullName, phone }) => {
          setError(null)
          const res = await api.PATCH("/api/me", { body: { fullName, ...(phone ? { phone } : {}) } })
          if (!res.data) return setError((res.error as ApiError)?.message ?? "Something went wrong. Try again.")
          queryClient.setQueryData(meQueryKey, res.data)
          toast.success("Details saved")
        })}
      >
        <div className="flex flex-col gap-4 md:grid md:grid-cols-2">
          <Field label="Full name" htmlFor="fullName" error={formState.errors.fullName?.message}>
            <Input id="fullName" autoComplete="name" aria-invalid={!!formState.errors.fullName} {...register("fullName")} />
          </Field>
          <Field
            label="Mobile number"
            htmlFor="phone"
            help="Shown to organizers when you apply, and to vendors at events you run."
            error={formState.errors.phone?.message}
          >
            <InputPrefix prefix="+63">
              <Input id="phone" type="tel" inputMode="tel" autoComplete="tel-national" aria-invalid={!!formState.errors.phone} {...register("phone")} />
            </InputPrefix>
          </Field>
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" className="self-end" disabled={formState.isSubmitting}>
          Save details
        </Button>
      </form>
    </Section>
  )
}

function EmailRow({ me }: { me: MeResponse }) {
  const [open, setOpen] = React.useState(false)
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<{ newEmail: string }>({
    resolver: zodResolver(z.object({ newEmail: z.email("Enter a valid email") })),
    defaultValues: { newEmail: "" },
  })
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <p className="text-label">Email</p>
          <p className="flex flex-wrap items-center gap-2 text-sm break-all">
            {me.email}
            <Badge tone="success">Confirmed</Badge>
          </p>
        </div>
        {!open && !sentTo && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Change email
          </Button>
        )}
      </div>
      {sentTo ? (
        <Alert tone="success">
          <span>We sent a link to {me.email} to approve the change.</span>
          <span>After that, we&apos;ll send one to {sentTo}. Your email changes when you open it.</span>
        </Alert>
      ) : (
        open && (
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={handleSubmit(async ({ newEmail }) => {
              const { error: e } = await authClient.changeEmail({ newEmail, callbackURL: "/account" })
              if (e) return setError(e.message ?? "We couldn't change your email. Try another address.")
              setSentTo(newEmail)
            })}
          >
            <Alert tone="info">
              <span>We&apos;ll ask {me.email} to approve the change, then send a confirmation link to the new address. Your current email keeps working until then.</span>
            </Alert>
            <Field label="New email" htmlFor="newEmail" error={formState.errors.newEmail?.message}>
              <Input id="newEmail" type="email" autoComplete="email" aria-invalid={!!formState.errors.newEmail} {...register("newEmail")} />
            </Field>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex gap-2">
              <Button type="submit" variant="secondary" disabled={formState.isSubmitting}>
                Send confirmation link
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )
      )}
    </div>
  )
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: passwordSchema,
})

function PasswordRow({ me, details }: { me: MeResponse; details?: AccountDetails }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [state, setState] = React.useState<"idle" | "done" | "wrong">("idle")
  const { register, handleSubmit, reset, formState } = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  })
  if (!me.hasPassword) {
    return (
      <Row label="Password">
        <p className="text-muted">You sign in with Google, so there&apos;s no password to change.</p>
      </Row>
    )
  }
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <p className="text-label">Password</p>
          <p className="text-sm text-muted">
            {details?.passwordChangedAt ? `Last changed ${day.format(new Date(details.passwordChangedAt))}` : " "}
          </p>
        </div>
        {!open && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Change password
          </Button>
        )}
      </div>
      {state === "done" && <Alert tone="success">Password changed. We signed you out on your other devices.</Alert>}
      {open && (
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={handleSubmit(async (values) => {
            const { error } = await authClient.changePassword({ ...values, revokeOtherSessions: true })
            if (error) return setState("wrong")
            reset()
            setOpen(false)
            setState("done")
            await queryClient.invalidateQueries({ queryKey: ["account"] })
          })}
        >
          <div className="flex flex-col gap-3 md:grid md:grid-cols-2">
            <Field label="Current password" htmlFor="currentPassword" error={formState.errors.currentPassword?.message}>
              <PasswordInput id="currentPassword" autoComplete="current-password" {...register("currentPassword")} />
            </Field>
            <Field label="New password" htmlFor="newPassword" help="At least 8 characters" error={formState.errors.newPassword?.message}>
              <PasswordInput id="newPassword" autoComplete="new-password" {...register("newPassword")} />
            </Field>
          </div>
          {state === "wrong" && <Alert tone="danger">Your current password is wrong.</Alert>}
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" disabled={formState.isSubmitting}>
              Save new password
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

function SignIn({ me, details }: { me: MeResponse; details?: AccountDetails }) {
  const config = usePublicConfig()
  return (
    <Section id="signin" title="Email and sign-in">
      <EmailRow me={me} />
      <PasswordRow me={me} details={details} />
      {(config.data?.googleSignIn || details?.googleLinked) && (
        <Row label="Google" last>
          <p className="text-muted">
            {details?.googleLinked
              ? "Connected. You can sign in with Google."
              : `Not connected. Sign in with Google using ${me.email} to link it.`}
          </p>
        </Row>
      )}
    </Section>
  )
}

const approvalNames = { not_submitted: "Not submitted", pending_review: "Pending review", approved: "Approved", rejected: "Needs changes" } as const

function Roles({ me, details }: { me: MeResponse; details?: AccountDetails }) {
  const cards = [
    {
      role: "vendor" as const,
      title: "Vendor",
      Icon: StorefrontIcon,
      name: details?.vendor?.shopName,
      since: details?.vendor?.since,
      edit: ["/vendor/profile", "Edit shop profile"],
      add: "Find markets, apply for a slot, and track your payments. No approval needed.",
    },
    {
      role: "organizer" as const,
      title: "Organizer",
      Icon: CalendarBlankIcon,
      name: details?.organizer?.displayName,
      since: details?.organizer?.since,
      edit: ["/organizer/profile", "Edit organizer profile"],
      add: "Run your own markets. Creavent reviews your pages before you open events to vendors.",
    },
  ]
  return (
    <Section id="roles" title="Roles" intro="One login can be a vendor, an organizer, or both.">
      <div className="flex flex-col gap-3 md:grid md:grid-cols-2">
        {cards.map(({ role, title, Icon, name, since, edit, add }) => {
          const r = me.roles.find((x) => x.role === role)
          return (
            <div
              key={role}
              className={cn("flex flex-col gap-2.5 rounded-lg border p-4", r ? "border-border" : "border-dashed border-border-strong")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-label font-semibold">
                  <Icon aria-hidden="true" className="size-5" />
                  {title}
                </span>
                {!r ? (
                  <Badge dot={false}>Not added</Badge>
                ) : r.suspended ? (
                  <Badge tone="danger">Suspended</Badge>
                ) : r.approvalStatus && r.approvalStatus !== "approved" ? (
                  <Badge tone={r.approvalStatus === "rejected" ? "danger" : r.approvalStatus === "pending_review" ? "warning" : "neutral"}>
                    {approvalNames[r.approvalStatus]}
                  </Badge>
                ) : (
                  <Badge tone="success">{r.approvalStatus === "approved" ? "Approved" : "Active"}</Badge>
                )}
              </div>
              {r ? (
                <>
                  {name && (
                    <p className="text-sm text-muted">
                      {name}
                      {since && ` · since ${monthYear.format(new Date(since))}`}
                    </p>
                  )}
                  {r.suspended && (
                    <Alert tone="danger">
                      <span>This role is suspended{r.suspensionReason ? `: ${r.suspensionReason}` : "."}</span>
                      <span>Email support if you think this is a mistake.</span>
                    </Alert>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="secondary" size="sm">
                      <Link href={edit[0]}>{edit[1]}</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/${role}`}>Dashboard</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted">{add}</p>
                  <Button asChild size="sm" className="self-start">
                    <Link href={`/onboarding?role=${role}`}>Add {role} role</Link>
                  </Button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function Legal({ details }: { details?: AccountDetails }) {
  const config = usePublicConfig()
  const support = config.data?.supportEmail
  return (
    <Section id="legal" title="Terms and privacy">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {details?.legal.map((l) => (
          <React.Fragment key={l.document}>
            <dt className="text-muted">{l.document === "terms" ? "Terms of use" : "Privacy notice"}</dt>
            <dd>
              Accepted version {l.version} on {day.format(new Date(l.acceptedAt))} ·{" "}
              <Link href={`/${l.document}`} className="text-ink underline underline-offset-2">
                Read
              </Link>
            </dd>
          </React.Fragment>
        ))}
      </dl>
      <div className="h-px bg-border" />
      <p className="flex items-start gap-2 text-sm text-muted">
        <EnvelopeSimpleIcon aria-hidden="true" className="mt-0.5 size-4 flex-none" />
        <span>
          To close your account, email{" "}
          {support ? (
            <a href={`mailto:${support}`} className="text-ink underline underline-offset-2">
              {support}
            </a>
          ) : (
            "support"
          )}
          . We can&apos;t close it while you have a slot assigned or reserved.
        </span>
      </p>
    </Section>
  )
}

// /account (mockup Account): personal details, email and sign-in, roles, and
// terms and privacy.
export function AccountPage() {
  const { data: me } = useMe()
  const { data: details } = useAccountDetails()
  if (!me) return <p role="status" className="p-8 text-sm text-muted">Loading…</p>
  return (
    <Container className="py-6 md:py-10">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-10">
        <nav aria-label="Account sections" className="flex flex-col gap-1 md:sticky md:top-6 md:w-56 md:flex-none">
          <h1 className="mb-2 text-h1 md:text-h2">Account</h1>
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
            {sections.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="inline-flex min-h-11 flex-none items-center rounded-md px-3 text-label whitespace-nowrap text-muted no-underline hover:bg-sunken hover:text-ink"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>
        <div className="flex max-w-[760px] min-w-0 flex-1 flex-col gap-5">
          <PersonalDetails me={me} />
          <SignIn me={me} details={details} />
          <Roles me={me} details={details} />
          <Legal details={details} />
        </div>
      </div>
    </Container>
  )
}
