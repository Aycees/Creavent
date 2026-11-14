"use client"

import { organizerProfileUpdateSchema, type OnboardingState, type OrganizerProfileUpdateInput } from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { EyeIcon } from "@phosphor-icons/react"
import Link from "next/link"
import * as React from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Alert } from "@/components/ui/alert"
import { ApprovedMark } from "@/components/ui/approved-mark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { useMe } from "@/lib/queries"
import { initialsOf } from "@/lib/shell-user"
import { useUpload } from "@/lib/use-upload"
import { LinkList, Panel, PictureEditor, SaveBar, SlugField } from "./parts"
import { useProfile, useProfileSaved } from "./use-profile"

type Form = OrganizerProfileUpdateInput

const changeNames: Partial<Record<keyof Form, string>> = {
  displayName: "name",
  slug: "page link",
  logoFileId: "logo",
  city: "city",
  about: "about",
  socialLinks: "links",
  contactEmail: "contact email",
}

const day = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" })

function defaults(state: OnboardingState): Form {
  const o = state.organizer
  return {
    displayName: o?.displayName ?? "",
    slug: o?.slug ?? "",
    logoFileId: o?.logo?.id ?? null,
    city: o?.city ?? "",
    about: o?.about ?? "",
    socialLinks: o?.socialLinks ?? [],
    contactEmail: o?.contactEmail ?? "",
  }
}

// /organizer/profile (mockup OrgProfileEdit).
export function OrganizerProfileEdit() {
  const { data: state, isError } = useProfile()
  if (isError) return <Alert tone="danger">We couldn&apos;t load your profile. Refresh to try again.</Alert>
  if (!state) return <p role="status" className="text-sm text-muted">Loading…</p>
  if (!state.organizer) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-h1">Organizer profile</h1>
        <p className="text-body text-muted">Set up your organizer page first.</p>
        <Button asChild>
          <Link href="/onboarding?role=organizer">Set up your organizer page</Link>
        </Button>
      </div>
    )
  }
  return <OrganizerForm state={state} />
}

function OrganizerForm({ state }: { state: OnboardingState }) {
  const o = state.organizer!
  const { data: me } = useMe()
  const saved = useProfileSaved()
  const logoUpload = useUpload("organizer_logo")
  const [logos, setLogos] = React.useState<Record<string, string>>(() => (o.logo ? { [o.logo.id]: o.logo.url } : {}))
  const [error, setError] = React.useState<string | null>(null)
  const { register, control, handleSubmit, reset, setValue, formState } = useForm<Form>({
    resolver: zodResolver(organizerProfileUpdateSchema, undefined, { raw: true }),
    defaultValues: defaults(state),
  })
  const values = useWatch({ control }) as Form
  const logoUrl = values.logoFileId ? logos[values.logoFileId] ?? null : null
  const changes = Object.keys(formState.dirtyFields).flatMap((k) => changeNames[k as keyof Form] ?? [])
  const approved = o.approvalStatus === "approved"
  const reReview =
    approved &&
    (values.displayName !== o.displayName || (values.socialLinks ?? []).some((l) => !o.reviewedLinks.includes(l)))

  async function onSubmit(body: Form) {
    setError(null)
    const res = await api.PUT("/api/organizer/profile", { body })
    if (!res.data) return setError((res.error as { message?: string } | undefined)?.message ?? "Something went wrong. Try again.")
    await saved(res.data)
    reset(defaults(res.data))
    toast.success(res.data.organizer?.approvalStatus === "pending_review" && approved ? "Saved and sent for review" : "Organizer profile saved")
  }

  const statusPanel = (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 md:p-5">
      {approved ? (
        <>
          <ApprovedMark />
          <p className="text-sm text-muted">
            {o.reviewedAt && `Approved ${day.format(new Date(o.reviewedAt))}. `}Your badge shows on your page, events and event cards.
          </p>
        </>
      ) : (
        <>
          <Badge tone={o.approvalStatus === "pending_review" ? "warning" : o.approvalStatus === "rejected" ? "danger" : "neutral"} className="self-start">
            {o.approvalStatus === "pending_review" ? "Pending review" : o.approvalStatus === "rejected" ? "Needs changes" : "Not submitted"}
          </Badge>
          <Link href="/organizer/approval" className="text-sm text-ink underline underline-offset-2">
            {o.approvalStatus === "pending_review" ? "See your review" : "Get approved"}
          </Link>
        </>
      )}
    </div>
  )

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1">Organizer profile</h1>
          <p className="text-sm text-muted">This is your public organizer page, and the name on every event you post.</p>
        </div>
        {o.slug && (
          <Button asChild variant="secondary">
            <Link href={`/organizers/${o.slug}`}>
              <EyeIcon aria-hidden="true" />
              View public page
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-5 md:grid md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-6">
        <div className="flex flex-col gap-5">
          <section className="rounded-lg border border-border bg-surface p-4 md:p-6">
            <PictureEditor
              title="Logo"
              intro="Shown on your organizer page, event pages and event cards."
              hint="At least 256 × 256 px. JPEG, PNG or WebP up to 5 MB."
              url={logoUrl}
              fallback={initialsOf(values.displayName || "?")}
              pending={logoUpload.pending}
              error={logoUpload.error}
              onPick={async (file) => {
                const done = await logoUpload.upload(file)
                if (done) {
                  setLogos((m) => ({ ...m, [done.id]: done.url }))
                  setValue("logoFileId", done.id, { shouldDirty: true })
                }
              }}
              onRemove={() => setValue("logoFileId", null, { shouldDirty: true })}
            />
          </section>

          <div className="md:hidden">{statusPanel}</div>

          <Panel title="Page details">
            <Field label="Organizer name" htmlFor="displayName" error={formState.errors.displayName?.message}>
              <Input id="displayName" aria-invalid={!!formState.errors.displayName} {...register("displayName")} />
            </Field>
            <Controller
              control={control}
              name="slug"
              render={({ field, fieldState }) => (
                <SlugField
                  kind="organizer"
                  current={o.slug}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  help="Shared in Facebook groups and on posters. Changing it breaks those links."
                />
              )}
            />
            <Field label="Where you usually hold events" htmlFor="city" error={formState.errors.city?.message}>
              <Input id="city" autoComplete="address-level2" className="md:max-w-80" {...register("city")} />
            </Field>
            <Field label="About" htmlFor="about" error={formState.errors.about?.message}>
              <Textarea id="about" {...register("about")} />
            </Field>
          </Panel>

          <Panel title="Pages and past events" intro="Shown on your organizer page. Creavent reviewed these for your approval.">
            <Controller
              control={control}
              name="socialLinks"
              render={({ field, fieldState }) => (
                <LinkList
                  label="Your links"
                  links={field.value}
                  reviewed={o.reviewedLinks}
                  placeholder="Paste a link"
                  onChange={field.onChange}
                  error={fieldState.error?.message ?? formState.errors.socialLinks?.root?.message}
                />
              )}
            />
            <p className="text-cap text-muted">Keep at least one link.</p>
          </Panel>

          {reReview && (
            <Alert tone="warning">
              <span>A new name or a new link sends your page back to review. Your badge hides until Creavent approves it again.</span>
            </Alert>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="hidden md:block">{statusPanel}</div>
          <Panel title="Contact for Creavent">
            <Field label="Contact email" htmlFor="contactEmail" error={formState.errors.contactEmail?.message}>
              <Input id="contactEmail" type="email" autoComplete="email" {...register("contactEmail")} />
            </Field>
            <p className="text-sm">
              {me?.phone && <>Mobile {me.phone} · </>}
              <Link href="/account" className="text-ink underline underline-offset-2">
                change in Account
              </Link>
            </p>
            <p className="text-cap text-muted">Not public. Vendors see each event&apos;s own contact details.</p>
          </Panel>
        </aside>
      </div>

      <SaveBar dirty={formState.isDirty} changes={changes} saving={formState.isSubmitting} error={error} onDiscard={() => reset()} />
    </form>
  )
}
