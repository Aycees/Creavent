"use client"

import {
  vendorContactSchema,
  vendorShopSchema,
  type OnboardingState,
  type VendorContactInput,
  type VendorShopInput,
} from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, PlusIcon, XIcon } from "@phosphor-icons/react"
import * as React from "react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Field, InputPrefix } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { useUpload } from "@/lib/use-upload"
import { ImagePicker, LinksEditor, StepActions, StepHeading } from "./parts"
import { useSave } from "./use-save"

type StepProps = { state: OnboardingState; onBack: () => void; finishLater: React.ReactNode }

// Vendor step 2: the shop (spec §1.1).
export function VendorShopStep({ state, onBack, finishLater }: StepProps) {
  const { save, error, saving } = useSave()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<VendorShopInput>({
    resolver: zodResolver(vendorShopSchema, undefined, { raw: true }),
    defaultValues: {
      shopName: state.vendor?.shopName ?? "",
      categoryIds: state.vendor?.categoryIds ?? [],
      description: state.vendor?.description ?? "",
      products: state.vendor?.products ?? "",
    },
  })
  const description = useWatch({ control, name: "description" }) ?? ""

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => save(api.PUT("/api/onboarding/vendor/shop", { body: values })))}
      className="flex flex-col gap-6"
    >
      <StepHeading
        title="Tell us about your shop"
        intro="Organizers see this when you apply, and shoppers see it on your vendor page. You can change it any time."
      />
      <Field label="Shop name" htmlFor="shopName" help="Shown on the vendor list of every event you join." error={errors.shopName?.message}>
        <Input id="shopName" autoComplete="organization" aria-invalid={!!errors.shopName} {...register("shopName")} />
      </Field>
      <div className="flex flex-col gap-2">
        <p id="categories-label" className="text-label">
          What do you sell? <span className="font-normal text-muted">Pick all that apply</span>
        </p>
        <Controller
          control={control}
          name="categoryIds"
          render={({ field }) => (
            <div role="group" aria-labelledby="categories-label" className="flex flex-wrap gap-2">
              {state.categories.map((c) => {
                const on = field.value.includes(c.id)
                return (
                  <Chip
                    key={c.id}
                    pressed={on}
                    onClick={() => field.onChange(on ? field.value.filter((id) => id !== c.id) : [...field.value, c.id])}
                  >
                    {on && <CheckIcon aria-hidden="true" weight="bold" className="size-4" />}
                    {c.name}
                  </Chip>
                )
              })}
            </div>
          )}
        />
        {errors.categoryIds ? (
          <p className="text-help text-danger-ink">{errors.categoryIds.message}</p>
        ) : (
          <p className="text-help text-muted">We use this to show you events that accept your category.</p>
        )}
      </div>
      <Field label="About your shop" optional htmlFor="description" error={errors.description?.message}>
        <Textarea id="description" maxLength={300} {...register("description")} />
        <p className="text-right text-help text-muted">{description.length} / 300</p>
      </Field>
      <Field label="Products" optional htmlFor="products" help="Helps shoppers know what to look for at your stall." error={errors.products?.message}>
        <Input id="products" {...register("products")} />
      </Field>
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

// Vendor step 3: avatar and up to 8 photos, skippable (spec §1.1).
export function VendorPhotosStep({ state, onBack, finishLater }: StepProps) {
  const { save, error, saving } = useSave()
  const avatarUpload = useUpload("avatar")
  const photoUpload = useUpload("vendor_photo")
  const [avatar, setAvatar] = React.useState(state.avatar)
  const [photos, setPhotos] = React.useState(state.vendor?.photos ?? [])
  const photoInput = React.useRef<HTMLInputElement>(null)

  async function addPhotos(files: FileList) {
    for (const file of Array.from(files).slice(0, 8 - photos.length)) {
      const done = await photoUpload.upload(file)
      if (done) setPhotos((p) => [...p, { id: done.id, url: done.url }])
    }
  }

  function submit(skip: boolean) {
    return save(
      api.PUT("/api/onboarding/vendor/photos", {
        body: skip
          ? { avatarFileId: state.avatar?.id ?? null, photoFileIds: (state.vendor?.photos ?? []).map((p) => p.id) }
          : { avatarFileId: avatar?.id ?? null, photoFileIds: photos.map((p) => p.id) },
      })
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Show what you sell"
        intro="A logo and a few product photos help organizers picture your stall. You can add these later."
      />
      <ImagePicker
        round
        label="Shop logo or your photo"
        hint="At least 256 × 256 px, up to 5 MB"
        url={avatar?.url ?? null}
        pending={avatarUpload.pending}
        onPick={async (file) => {
          const done = await avatarUpload.upload(file)
          if (done) setAvatar({ id: done.id, url: done.url })
        }}
        onRemove={() => setAvatar(null)}
      />
      {avatarUpload.error && <Alert tone="danger">{avatarUpload.error}</Alert>}
      <div className="flex flex-col gap-2">
        <p className="text-label">
          Product photos <span className="font-normal text-muted">{photos.length} of 8</span>
        </p>
        <ul className="grid grid-cols-4 gap-2">
          {photos.map((p, i) => (
            <li key={p.id} className="relative aspect-square overflow-hidden rounded-md bg-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
              <img src={p.url} alt={`Product photo ${i + 1}`} className="size-full object-cover" />
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => setPhotos((list) => list.filter((x) => x.id !== p.id))}
                className="absolute top-1 right-1 grid size-8 place-items-center rounded-pill bg-surface/90 text-ink"
              >
                <XIcon aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
          {photos.length < 8 && (
            <li className="aspect-square">
              <button
                type="button"
                aria-label="Add photo"
                disabled={photoUpload.pending}
                onClick={() => photoInput.current?.click()}
                className="grid size-full place-items-center rounded-md border-[1.5px] border-dashed border-border-strong bg-surface text-muted"
              >
                {photoUpload.pending ? <span className="text-cap">Uploading…</span> : <PlusIcon aria-hidden="true" className="size-6" />}
              </button>
            </li>
          )}
        </ul>
        <input
          ref={photoInput}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files) void addPhotos(e.target.files)
            e.target.value = ""
          }}
        />
        <p className="text-help text-muted">JPEG, PNG or WebP, up to 10 MB each. They appear on your public vendor page.</p>
        {photoUpload.error && <Alert tone="danger">{photoUpload.error}</Alert>}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <StepActions>
        <Button type="button" variant="ghost" className="hidden md:inline-flex" onClick={onBack}>
          Back
        </Button>
        <div className="hidden flex-1 md:block" />
        {finishLater}
        <Button type="button" variant="ghost" block className="md:w-auto" disabled={saving} onClick={() => submit(true)}>
          Skip for now
        </Button>
        <Button type="button" block className="md:w-auto md:px-7" disabled={saving || avatarUpload.pending || photoUpload.pending} onClick={() => submit(false)}>
          Continue
        </Button>
      </StepActions>
    </div>
  )
}

// Vendor step 4: mobile number and social links (spec §1.1).
export function VendorContactStep({ state, email, onBack, finishLater }: StepProps & { email: string }) {
  const { save, error, saving } = useSave()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<VendorContactInput>({
    resolver: zodResolver(vendorContactSchema, undefined, { raw: true }),
    defaultValues: { phone: state.phone?.replace(/^\+63/, "") ?? "", socialLinks: state.vendor?.socialLinks ?? [] },
  })

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => save(api.PUT("/api/onboarding/vendor/contact", { body: values })))}
      className="flex flex-col gap-6"
    >
      <StepHeading
        title="How can people reach you?"
        intro="Your number is only for organizers. Your social links help shoppers find you."
      />
      <Field label="Mobile number" required htmlFor="phone" help="Organizers see it on your applications. It is never shown on your public page." error={errors.phone?.message}>
        <InputPrefix prefix="+63">
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="917 123 4567" aria-invalid={!!errors.phone} {...register("phone")} />
        </InputPrefix>
      </Field>
      <div className="flex flex-col gap-2">
        <p className="text-label">
          Social media <span className="font-normal text-muted">(optional, public)</span>
        </p>
        <Controller
          control={control}
          name="socialLinks"
          render={({ field, fieldState }) => (
            <LinksEditor
              id="social-link"
              label="Social media link"
              placeholder="facebook.com/yourshop"
              links={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message ?? (errors.socialLinks as unknown as Array<{ message?: string }> | undefined)?.find?.((e) => e?.message)?.message}
            />
          )}
        />
      </div>
      <p className="text-sm text-muted">
        We&apos;ll email you at {email} when an organizer approves you, assigns a slot or confirms your payment.
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <StepActions>
        <Button type="button" variant="ghost" className="hidden md:inline-flex" onClick={onBack}>
          Back
        </Button>
        <div className="hidden flex-1 md:block" />
        {finishLater}
        <Button type="submit" block className="md:w-auto md:px-7" disabled={saving}>
          Finish setup
        </Button>
      </StepActions>
    </form>
  )
}
