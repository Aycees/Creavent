"use client"

import { vendorProfileUpdateSchema, type OnboardingState, type VendorProfileUpdateInput } from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, EyeIcon, PlusIcon, StarIcon, XIcon } from "@phosphor-icons/react"
import Link from "next/link"
import * as React from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { initialsOf } from "@/lib/shell-user"
import { useUpload } from "@/lib/use-upload"
import { LinkList, Panel, PictureEditor, SaveBar, SlugField } from "./parts"
import { useProfile, useProfileSaved } from "./use-profile"

type Image = { id: string; url: string }
type Form = VendorProfileUpdateInput

const changeNames: Partial<Record<keyof Form, string>> = {
  shopName: "shop name",
  slug: "page link",
  categoryIds: "categories",
  description: "about",
  products: "products",
  avatarFileId: "profile picture",
  photoFileIds: "photos",
  socialLinks: "social media",
}

function defaults(state: OnboardingState): Form {
  const v = state.vendor
  return {
    shopName: v?.shopName ?? "",
    slug: v?.slug ?? "",
    categoryIds: v?.categoryIds ?? [],
    description: v?.description ?? "",
    products: v?.products ?? "",
    avatarFileId: state.avatar?.id ?? null,
    photoFileIds: v?.photos.map((p) => p.id) ?? [],
    socialLinks: v?.socialLinks ?? [],
  }
}

// /vendor/profile (mockup VendorProfileEdit).
export function VendorProfileEdit() {
  const { data: state, isError } = useProfile()
  if (isError) return <Alert tone="danger">We couldn&apos;t load your profile. Refresh to try again.</Alert>
  if (!state) return <p role="status" className="text-sm text-muted">Loading…</p>
  return <VendorForm state={state} />
}

function VendorForm({ state }: { state: OnboardingState }) {
  const saved = useProfileSaved()
  const avatarUpload = useUpload("avatar")
  const photoUpload = useUpload("vendor_photo")
  // Addresses of images uploaded on this page, which the saved state doesn't know yet.
  const [images, setImages] = React.useState<Record<string, string>>(() =>
    Object.fromEntries([...(state.vendor?.photos ?? []), ...(state.avatar ? [state.avatar] : [])].map((i) => [i.id, i.url]))
  )
  const [error, setError] = React.useState<string | null>(null)
  const photoInput = React.useRef<HTMLInputElement>(null)
  const form = useForm<Form>({
    resolver: zodResolver(vendorProfileUpdateSchema, undefined, { raw: true }),
    defaultValues: defaults(state),
  })
  const { register, control, handleSubmit, reset, setValue, formState } = form
  const values = useWatch({ control }) as Form
  const description = values.description ?? ""
  const photos: Image[] = (values.photoFileIds ?? []).map((id) => ({ id, url: images[id] ?? "" }))
  const avatarUrl = values.avatarFileId ? images[values.avatarFileId] ?? null : null
  const categories = state.categories.filter((c) => values.categoryIds?.includes(c.id)).map((c) => c.name)
  const changes = Object.keys(formState.dirtyFields).flatMap((k) => changeNames[k as keyof Form] ?? [])

  function setPhotos(ids: string[]) {
    setValue("photoFileIds", ids, { shouldDirty: true })
  }

  async function addPhotos(files: FileList) {
    for (const file of Array.from(files).slice(0, 8 - photos.length)) {
      const done = await photoUpload.upload(file)
      if (done) {
        setImages((m) => ({ ...m, [done.id]: done.url }))
        setPhotos([...form.getValues("photoFileIds"), done.id])
      }
    }
  }

  async function onSubmit(body: Form) {
    setError(null)
    const res = await api.PUT("/api/vendor/profile", { body })
    if (!res.data) return setError((res.error as { message?: string } | undefined)?.message ?? "Something went wrong. Try again.")
    await saved(res.data)
    reset(defaults(res.data))
    toast.success("Shop profile saved")
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1">Shop profile</h1>
          <p className="text-sm text-muted">Shoppers see this on your vendor page. Organizers see it when you apply.</p>
        </div>
        {state.vendor?.slug && (
          <Button asChild variant="secondary">
            <Link href={`/vendors/${state.vendor.slug}`}>
              <EyeIcon aria-hidden="true" />
              View public page
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-5 md:grid md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-8">
        <div className="flex flex-col gap-5">
          <section className="rounded-lg border border-border bg-surface p-4 md:p-6">
            <PictureEditor
              round
              title="Profile picture"
              intro="Your shop logo or a photo of you. Shown on your vendor page and on event vendor lists."
              hint="Square, at least 256 × 256 px. JPEG, PNG or WebP up to 5 MB."
              url={avatarUrl}
              fallback={initialsOf(values.shopName || "?")}
              pending={avatarUpload.pending}
              error={avatarUpload.error}
              onPick={async (file) => {
                const done = await avatarUpload.upload(file)
                if (done) {
                  setImages((m) => ({ ...m, [done.id]: done.url }))
                  setValue("avatarFileId", done.id, { shouldDirty: true })
                }
              }}
              onRemove={() => setValue("avatarFileId", null, { shouldDirty: true })}
            />
          </section>

          <Panel title="Shop details">
            <Field label="Shop name" htmlFor="shopName" help="Shown on the vendor list of every event you join." error={formState.errors.shopName?.message}>
              <Input id="shopName" aria-invalid={!!formState.errors.shopName} {...register("shopName")} />
            </Field>
            <Controller
              control={control}
              name="slug"
              render={({ field, fieldState }) => (
                <SlugField
                  kind="vendor"
                  current={state.vendor?.slug ?? null}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  help="Your vendor page address."
                />
              )}
            />
            <div className="flex flex-col gap-2">
              <p id="categories-label" className="text-label">
                What you sell <span className="font-normal text-muted">Pick all that apply</span>
              </p>
              <Controller
                control={control}
                name="categoryIds"
                render={({ field }) => (
                  <div role="group" aria-labelledby="categories-label" className="flex flex-wrap gap-2">
                    {state.categories.map((c) => {
                      const on = field.value.includes(c.id)
                      return (
                        <Chip key={c.id} pressed={on} onClick={() => field.onChange(on ? field.value.filter((id) => id !== c.id) : [...field.value, c.id])}>
                          {on && <CheckIcon aria-hidden="true" weight="bold" className="size-4" />}
                          {c.name}
                        </Chip>
                      )
                    })}
                  </div>
                )}
              />
              {formState.errors.categoryIds && <p className="text-help text-danger-ink">{formState.errors.categoryIds.message}</p>}
            </div>
            <Field label="About your shop" htmlFor="description" error={formState.errors.description?.message}>
              <Textarea id="description" maxLength={300} {...register("description")} />
              <p className="text-right text-help text-muted">{description.length} / 300</p>
            </Field>
            <Field label="Products" htmlFor="products" error={formState.errors.products?.message}>
              <Input id="products" {...register("products")} />
            </Field>
          </Panel>

          <Panel
            title="Product photos"
            intro="The cover photo leads your vendor page."
            aside={<span className="text-sm whitespace-nowrap text-muted">{photos.length} of 8</span>}
          >
            <ul className="grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-3">
              {photos.map((p, i) => (
                <li key={p.id} className={`relative aspect-square overflow-hidden rounded-md bg-sunken ${i === 0 ? "outline-2 -outline-offset-2 outline-ink" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
                  {p.url && <img src={p.url} alt={`Product photo ${i + 1}`} className="size-full object-cover" />}
                  {i === 0 && (
                    <Badge tone="ink" dot={false} className="absolute top-1.5 left-1.5">
                      Cover
                    </Badge>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => setPhotos(photos.filter((x) => x.id !== p.id).map((x) => x.id))}
                    className="absolute top-1 right-1 grid size-11 place-items-center rounded-pill bg-surface/90 text-ink"
                  >
                    <XIcon aria-hidden="true" className="size-4" />
                  </button>
                  {i > 0 && (
                    <button
                      type="button"
                      aria-label={`Make photo ${i + 1} the cover`}
                      onClick={() => setPhotos([p.id, ...photos.filter((x) => x.id !== p.id).map((x) => x.id)])}
                      className="absolute bottom-1 left-1 flex h-11 items-center gap-1 rounded-pill bg-surface/90 px-2.5 text-cap text-ink"
                    >
                      <StarIcon aria-hidden="true" className="size-4" />
                      Cover
                    </button>
                  )}
                </li>
              ))}
              {photos.length < 8 && (
                <li className="aspect-square">
                  <button
                    type="button"
                    disabled={photoUpload.pending}
                    onClick={() => photoInput.current?.click()}
                    className="flex size-full flex-col items-center justify-center gap-1.5 rounded-md border-[1.5px] border-dashed border-border-strong bg-surface text-muted"
                  >
                    <PlusIcon aria-hidden="true" className="size-6" />
                    <span className="text-cap">{photoUpload.pending ? "Uploading…" : "Add photos"}</span>
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
            {photoUpload.error && <Alert tone="danger">{photoUpload.error}. On iPhone, set Camera › Formats to Most Compatible, or choose a screenshot.</Alert>}
            <p className="text-cap text-muted">JPEG, PNG or WebP, up to 10 MB each.</p>
          </Panel>

          <Panel title="Social media" intro="Public. Helps shoppers follow your shop.">
            <Controller
              control={control}
              name="socialLinks"
              render={({ field, fieldState }) => (
                <LinkList
                  label="Your social links"
                  links={field.value}
                  placeholder="Paste a link, like your TikTok"
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          </Panel>
        </div>

        <aside className="hidden flex-col gap-4 md:sticky md:top-6 md:flex">
          <p className="text-label text-muted">Preview</p>
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-14 flex-none place-items-center overflow-hidden rounded-pill bg-sunken text-label text-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
                {avatarUrl ? <img src={avatarUrl} alt="" className="size-full object-cover" /> : initialsOf(values.shopName || "?")}
              </div>
              <div className="min-w-0">
                <p className="truncate text-h3">{values.shopName}</p>
                <p className="text-cap text-muted">{categories.join(" · ")}</p>
              </div>
            </div>
            {description && <p className="text-sm">{description}</p>}
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.slice(0, 3).map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized
                  <img key={p.id} src={p.url} alt="" className="aspect-square rounded-sm object-cover" />
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 rounded-md bg-sunken p-4">
            <p className="text-label font-semibold">Not on this page</p>
            <p className="text-sm text-muted">
              Your name, email, mobile number and password are in{" "}
              <Link href="/account" className="text-ink underline underline-offset-2">
                Account settings
              </Link>
              . Permits are uploaded with each application.
            </p>
          </div>
        </aside>
      </div>

      <Link href="/account" className="flex min-h-11 items-center justify-center text-sm text-ink underline underline-offset-2 md:hidden">
        Name, email and mobile number are in Account settings
      </Link>

      <SaveBar
        dirty={formState.isDirty}
        changes={changes}
        saving={formState.isSubmitting}
        error={error}
        onDiscard={() => reset()}
        className="bottom-18 md:bottom-0"
      />
    </form>
  )
}
