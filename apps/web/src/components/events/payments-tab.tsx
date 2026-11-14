"use client"

import { eventPaymentsSchema, paymentChannelLabels, type EventPaymentsInput, type EventSetup, type PaymentChannel } from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, UploadSimpleIcon } from "@phosphor-icons/react"
import * as React from "react"
import { useFieldArray, useForm, useWatch, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue } from "react-hook-form"
import { toast } from "sonner"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Segmented, SegmentedItem } from "@/components/ui/segmented"
import { api } from "@/lib/api"
import { useUpload } from "@/lib/use-upload"
import { SetupPanel, TabSaveBar } from "./parts"
import { saveError, useSetupSaved } from "./queries"

type Form = EventPaymentsInput
const channels = Object.keys(paymentChannelLabels) as PaymentChannel[]

function defaults(setup: EventSetup): Form {
  return {
    deadlineHours: setup.payments.deadlineHours,
    methods: setup.payments.methods.map((m) => ({
      id: m.id,
      channel: m.channel,
      accountName: m.accountName ?? "",
      accountNumber: m.accountNumber ?? "",
      qrFileId: m.qr?.id ?? null,
      notes: m.notes ?? "",
    })),
  }
}

const numberLabel = (channel: PaymentChannel) => (channel === "gcash" || channel === "maya" ? `${paymentChannelLabels[channel]} number` : "Account number")

// The Payments tab (spec §6.1, mockup OrgEventPayments).
export function PaymentsTab({ setup }: { setup: EventSetup }) {
  const saved = useSetupSaved(setup.id)
  const [error, setError] = React.useState<string | null>(null)
  const { register, control, handleSubmit, reset, setValue, formState } = useForm<Form>({
    resolver: zodResolver(eventPaymentsSchema, undefined, { raw: true }),
    defaultValues: defaults(setup),
  })
  const { fields, append, remove } = useFieldArray({ control, name: "methods", keyName: "key" })
  const qrUrls = React.useMemo(() => Object.fromEntries(setup.payments.methods.flatMap((m) => (m.qr ? [[m.qr.id, m.qr.url]] : []))), [setup])

  async function onSubmit(form: Form) {
    setError(null)
    const body = eventPaymentsSchema.parse(form)
    const res = await api.PUT("/api/organizer/events/{id}/payments", { params: { path: { id: setup.id } }, body })
    if (!res.data) {
      const { message, details } = saveError(res.error)
      return setError(details[0]?.message ?? message)
    }
    saved(res.data)
    reset(defaults(res.data))
    toast.success("Payment details saved")
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_300px] md:items-start md:gap-8">
      <div className="flex flex-col gap-6">
        {setup.payments.methods.length === 0 && (
          <Alert tone="warning">Add at least one way vendors can pay you, then you can open this event to vendors.</Alert>
        )}
        <SetupPanel
          title="Payment options"
          intro="Add every account you accept. Vendors pick the one they paid with when they upload their proof, so you know where to check."
        >
          {fields.map((f, i) => (
            <OptionCard
              key={f.key}
              index={i}
              control={control}
              register={register}
              setValue={setValue}
              errors={formState.errors}
              qrUrls={qrUrls}
              onRemove={() => remove(i)}
            />
          ))}
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={() => append({ channel: "gcash", accountName: "", accountNumber: "", qrFileId: null, notes: "" })}
          >
            <PlusIcon aria-hidden="true" />
            Add another option
          </Button>
        </SetupPanel>

        <SetupPanel title="Payment deadline">
          <Field
            label="Vendors pay within"
            htmlFor="deadlineHours"
            error={formState.errors.deadlineHours?.message}
            help="Never later than the start of the event's first day. Late payments are flagged for you. Nothing is canceled automatically."
          >
            <div className="flex items-center gap-2">
              <Input
                id="deadlineHours"
                type="number"
                inputMode="numeric"
                min={1}
                max={168}
                className="w-24 tabular-nums"
                aria-invalid={!!formState.errors.deadlineHours}
                {...register("deadlineHours", { valueAsNumber: true })}
              />
              <span className="text-body text-muted">hours after you assign their slot</span>
            </div>
          </Field>
          <p className="text-cap text-muted">Changes apply only to slots you assign after saving.</p>
        </SetupPanel>

        <TabSaveBar label="Save payment details" saving={formState.isSubmitting} dirty={formState.isDirty} error={error} />
      </div>

      <aside className="flex flex-col gap-2 rounded-lg bg-sunken p-4">
        <p className="text-label">What vendors see with your options</p>
        <p className="text-sm">
          &quot;Pay the organizer directly. Creavent doesn&apos;t hold or guarantee payments. Check that the organizer is Approved by Creavent and look at
          their past events before you pay.&quot;
        </p>
        <p className="text-cap text-muted">Shown after a vendor gets a slot, with the amount due and the deadline.</p>
      </aside>
    </form>
  )
}

function OptionCard({
  index,
  control,
  register,
  setValue,
  errors,
  qrUrls,
  onRemove,
}: {
  index: number
  control: Control<Form>
  register: UseFormRegister<Form>
  setValue: UseFormSetValue<Form>
  errors: FieldErrors<Form>
  qrUrls: Record<string, string>
  onRemove: () => void
}) {
  const n = index + 1
  const headingId = React.useId()
  const channel = useWatch({ control, name: `methods.${index}.channel` })
  const qrFileId = useWatch({ control, name: `methods.${index}.qrFileId` })
  const upload = useUpload("payment_qr")
  const [uploaded, setUploaded] = React.useState<Record<string, string>>({})
  const qrUrl = qrFileId ? (uploaded[qrFileId] ?? qrUrls[qrFileId] ?? null) : null
  const input = React.useRef<HTMLInputElement>(null)
  const e = errors.methods?.[index]
  const id = (name: string) => `m${index}-${name}`

  return (
    <fieldset aria-labelledby={headingId} className="flex flex-col gap-4 rounded-md border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id={headingId} className="text-label font-semibold">
          Option {n}
        </h3>
        <Button type="button" variant="danger-ghost" size="sm" aria-label={`Remove option ${n}`} onClick={onRemove}>
          Remove
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-label">Channel</span>
        <Segmented className="flex w-full rounded-lg md:w-auto md:self-start">
          {channels.map((c) => (
            <SegmentedItem
              key={c}
              type="button"
              active={channel === c}
              className="h-10 flex-1 justify-center rounded-md px-2 md:flex-none md:px-4"
              aria-label={paymentChannelLabels[c]}
              onClick={() => setValue(`methods.${index}.channel`, c, { shouldDirty: true })}
            >
              {c === "bank" ? (
                <>
                  <span className="md:hidden">Bank</span>
                  <span className="hidden md:inline">Bank transfer</span>
                </>
              ) : (
                paymentChannelLabels[c]
              )}
            </SegmentedItem>
          ))}
        </Segmented>
      </div>
      <div className="flex flex-col gap-4 md:grid md:grid-cols-2">
        <Field label="Account name" htmlFor={id("name")} error={e?.accountName?.message}>
          <Input id={id("name")} aria-invalid={!!e?.accountName} {...register(`methods.${index}.accountName`)} />
        </Field>
        <Field label={numberLabel(channel)} htmlFor={id("number")} error={e?.accountNumber?.message}>
          <Input id={id("number")} inputMode="numeric" className="tabular-nums" aria-invalid={!!e?.accountNumber} {...register(`methods.${index}.accountNumber`)} />
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-label">
          QR code <span className="font-normal text-muted">(optional)</span>
        </span>
        <div className="flex items-center gap-3">
          {qrUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- private file, opened through the API
            <img src={qrUrl} alt={`QR code for option ${n}`} className="size-20 flex-none rounded-md border border-border object-contain" />
          )}
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={upload.pending} onClick={() => input.current?.click()}>
                <UploadSimpleIcon aria-hidden="true" className="size-4" />
                {upload.pending ? "Uploading…" : qrUrl ? "Replace QR" : "Upload QR"}
              </Button>
              {qrUrl && (
                <Button type="button" variant="danger-ghost" size="sm" onClick={() => setValue(`methods.${index}.qrFileId`, null, { shouldDirty: true })}>
                  Remove QR
                </Button>
              )}
            </div>
            <p className="text-cap text-muted">JPEG, PNG or WebP, up to 5 MB. Only vendors with a slot can see it.</p>
            {upload.error && <p className="text-help text-danger-ink">{upload.error}</p>}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={`QR code file for option ${n}`}
            className="sr-only"
            tabIndex={-1}
            onChange={async (ev) => {
              const file = ev.target.files?.[0]
              ev.target.value = ""
              if (!file) return
              const done = await upload.upload(file)
              if (done) {
                setUploaded((m) => ({ ...m, [done.id]: done.url }))
                setValue(`methods.${index}.qrFileId`, done.id, { shouldDirty: true })
              }
            }}
          />
        </div>
      </div>
      <Field label="Note for vendors" optional htmlFor={id("notes")} error={e?.notes?.message}>
        <Input id={id("notes")} placeholder="For example, BPI savings" {...register(`methods.${index}.notes`)} />
      </Field>
    </fieldset>
  )
}
