"use client"

import {
  organizerContactSchema,
  organizerPageSchema,
  slugify,
  type OnboardingState,
  type OrganizerContactInput,
  type OrganizerPageInput,
} from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import * as React from "react"
import { Controller, useForm } from "react-hook-form"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, InputPrefix } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { useUpload } from "@/lib/use-upload"
import { ImagePicker, LinksEditor, StepActions, StepHeading } from "./parts"
import { useSave } from "./use-save"

type StepProps = { state: OnboardingState; onBack: () => void; finishLater: React.ReactNode }

// Organizer step 2: the organizer page (spec §1.1).
export function OrganizerPageStep({ state, onBack, finishLater }: StepProps) {
  const { save, error, saving } = useSave()
  const logoUpload = useUpload("organizer_logo")
  const o = state.organizer
  const [logo, setLogo] = React.useState(o?.logo ?? null)
  const [slugEdited, setSlugEdited] = React.useState(Boolean(o?.slug))
  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<OrganizerPageInput>({
    resolver: zodResolver(organizerPageSchema, undefined, { raw: true }),
    defaultValues: {
      displayName: o?.displayName ?? "",
      slug: o?.slug ?? "",
      logoFileId: o?.logo?.id ?? null,
      city: o?.city ?? "Davao City",
      about: o?.about ?? "",
    },
  })

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) =>
        save(api.PUT("/api/onboarding/organizer/page", { body: { ...values, logoFileId: logo?.id ?? null } }))
      )}
      className="flex flex-col gap-6"
    >
      <StepHeading
        title="Set up your organizer page"
        intro="Shoppers and vendors see this on your public page and on every event you post."
      />
      <ImagePicker
        label="Logo (optional)"
        hint="At least 256 × 256 px, up to 5 MB"
        url={logo?.url ?? null}
        pending={logoUpload.pending}
        onPick={async (file) => {
          const done = await logoUpload.upload(file)
          if (done) setLogo({ id: done.id, url: done.url })
        }}
        onRemove={() => setLogo(null)}
      />
      {logoUpload.error && <Alert tone="danger">{logoUpload.error}</Alert>}
      <Field label="Organizer name" htmlFor="displayName" error={errors.displayName?.message}>
        <Input
          id="displayName"
          autoComplete="organization"
          aria-invalid={!!errors.displayName}
          {...register("displayName", {
            onChange: (e) => {
              if (!slugEdited) setValue("slug", slugify(e.target.value))
            },
          })}
        />
      </Field>
      <Field label="Page link" htmlFor="slug" help="Lowercase letters, numbers, and hyphens." error={errors.slug?.message}>
        <InputPrefix prefix="/organizers/">
          <Input id="slug" autoCapitalize="none" aria-invalid={!!errors.slug} {...register("slug", { onChange: () => setSlugEdited(true) })} />
        </InputPrefix>
      </Field>
      <Field label="Where you usually hold events" htmlFor="city" error={errors.city?.message}>
        <Input id="city" autoComplete="address-level2" {...register("city")} />
      </Field>
      <Field label="About" optional htmlFor="about" error={errors.about?.message}>
        <Textarea id="about" {...register("about")} />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <StepActions>
        <Button type="button" variant="ghost" className="hidden md:inline-flex" onClick={onBack}>
          Back
        </Button>
        <div className="hidden flex-1 md:block" />
        {finishLater}
        <Button type="submit" block className="md:w-auto md:px-7" disabled={saving || logoUpload.pending}>
          Continue
        </Button>
      </StepActions>
    </form>
  )
}

// Organizer step 3: how Creavent and vendors reach them (spec §1.1).
export function OrganizerContactStep({ state, onBack, finishLater }: StepProps) {
  const { save, error, saving } = useSave()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrganizerContactInput>({
    resolver: zodResolver(organizerContactSchema, undefined, { raw: true }),
    defaultValues: { phone: state.phone?.replace(/^\+63/, "") ?? "", contactEmail: state.organizer?.contactEmail ?? "" },
  })

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => save(api.PUT("/api/onboarding/organizer/contact", { body: values })))}
      className="flex flex-col gap-6"
    >
      <StepHeading
        title="How can we reach you?"
        intro="Creavent uses these to contact you about your approval. Vendors who apply also see your number."
      />
      <Field label="Mobile number" required htmlFor="phone" error={errors.phone?.message}>
        <InputPrefix prefix="+63">
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="917 123 4567" aria-invalid={!!errors.phone} {...register("phone")} />
        </InputPrefix>
      </Field>
      <Field
        label="Contact email"
        required
        htmlFor="contactEmail"
        help="Can be different from your login email, like your page's inbox."
        error={errors.contactEmail?.message}
      >
        <Input id="contactEmail" type="email" autoComplete="email" aria-invalid={!!errors.contactEmail} {...register("contactEmail")} />
      </Field>
      <p className="text-sm text-muted">
        For each event you&apos;ll add separate contact details for vendors, like a GCash number or a group chat link.
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <StepActions>
        <Button type="button" variant="ghost" className="hidden md:inline-flex" onClick={onBack}>
          Back
        </Button>
        <div className="hidden flex-1 md:block" />
        {finishLater}
        <Button type="submit" block className="md:w-auto md:px-7" disabled={saving}>
          Continue
        </Button>
      </StepActions>
    </form>
  )
}

// Organizer step 4, and /organizer/approval: the links to review (spec §2.1).
export function OrganizerApprovalForm({
  state,
  onBack,
  finishLater,
  allowLater = true,
}: StepProps & { allowLater?: boolean }) {
  const { save, error, saving } = useSave()
  const { control, handleSubmit, getValues } = useForm<{ socialLinks: string[] }>({
    defaultValues: { socialLinks: state.organizer?.socialLinks ?? [] },
  })
  const [linkError, setLinkError] = React.useState<string | null>(null)

  function send(submit: boolean) {
    const socialLinks = getValues("socialLinks")
    // A link is needed to submit for review, not to do it later (flow 2).
    if (submit && socialLinks.length === 0) return setLinkError("Add at least one link")
    setLinkError(null)
    return save(api.POST("/api/onboarding/organizer/approval", { body: { socialLinks, submit } }))
  }

  return (
    <form noValidate onSubmit={handleSubmit(() => send(true))} className="flex flex-col gap-6">
      <StepHeading
        title="Get approved by Creavent"
        intro="Share where people already know you. We look at your public pages, not IDs, and reply in 1 to 2 business days. Until then you can still build draft events."
      />
      {state.organizer?.rejectionReason && (
        <Alert tone="warning">
          <span className="font-semibold">We couldn&apos;t approve you yet:</span>
          <span>{state.organizer.rejectionReason}</span>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-label">
          Your pages and past events <span className="font-normal text-muted">At least 1</span>
        </p>
        <Controller
          control={control}
          name="socialLinks"
          render={({ field }) => (
            <LinksEditor
              id="approval-link"
              label="Link to your page or a past event"
              placeholder="facebook.com/yourpage"
              links={field.value}
              onChange={field.onChange}
              error={linkError ?? undefined}
            />
          )}
        />
        <p className="text-help text-muted">These links also show on your organizer page.</p>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <p className="text-label font-semibold">What we check</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
          <li>Real past events with photos or posts</li>
          <li>Recent activity on your page</li>
          <li>The same name and contact details</li>
        </ul>
        <p className="text-cap text-muted">
          &quot;Approved by Creavent&quot; means we reviewed your public pages. It isn&apos;t a guarantee to vendors.
        </p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <StepActions>
        <Button type="button" variant="ghost" className="hidden md:inline-flex" onClick={onBack}>
          Back
        </Button>
        <div className="hidden flex-1 md:block" />
        {finishLater}
        {allowLater && (
          <Button type="button" variant="secondary" block className="md:w-auto" disabled={saving} onClick={() => send(false)}>
            Do this later
          </Button>
        )}
        <Button type="submit" variant="brand" block className="md:w-auto md:px-7" disabled={saving}>
          Submit for review
        </Button>
      </StepActions>
    </form>
  )
}
