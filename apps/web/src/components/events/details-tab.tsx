"use client"

import { eventCities, eventDetailsSchema, type EventDetailsInput, type EventSetup } from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarBlankIcon } from "@phosphor-icons/react"
import * as React from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Field } from "@/components/ui/field"
import { Input, inputClass } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { eventDays, formatSchedule } from "@/lib/event-format"
import { cn } from "@/lib/utils"
import { CoverField } from "./cover-field"
import { EventTypeChips, SetupPanel, TabSaveBar } from "./parts"
import { saveError, useSetupSaved } from "./queries"

type Form = EventDetailsInput

function defaults(setup: EventSetup): Form {
  const d = setup.details
  return {
    name: d.name,
    eventTypeId: d.eventTypeId,
    description: d.description ?? "",
    startDate: d.startDate ?? "",
    endDate: d.endDate ?? "",
    opensAt: d.opensAt ?? "",
    closesAt: d.closesAt ?? "",
    venueName: d.venueName ?? "",
    addressLine: d.addressLine ?? "",
    city: (d.city ?? "") as Form["city"],
    coverFileId: d.cover?.id ?? null,
    vendorContactInfo: d.vendorContactInfo ?? "",
    applicationsCloseAt: d.applicationsCloseAt ?? "",
    ingressInfo: d.ingressInfo ?? "",
  }
}

// Time pickers move in 5-minute steps (the step is in seconds).
const FIVE_MINUTES = 300

const fieldNames = Object.keys(eventDetailsSchema.shape) as (keyof Form)[]

// The Details tab (spec §3.1, §3.1.1, mockup OrgEventDetails).
export function DetailsTab({ setup }: { setup: EventSetup }) {
  const saved = useSetupSaved(setup.id)
  const [covers, setCovers] = React.useState<Record<string, string>>(() =>
    setup.details.cover ? { [setup.details.cover.id]: setup.details.cover.url } : {}
  )
  const [error, setError] = React.useState<string | null>(null)
  const { register, control, handleSubmit, reset, setValue, setError: setFieldError, formState } = useForm<Form>({
    resolver: zodResolver(eventDetailsSchema, undefined, { raw: true }),
    defaultValues: defaults(setup),
  })
  const values = useWatch({ control }) as Form
  const coverUrl = values.coverFileId ? covers[values.coverFileId] ?? null : null
  const schedule = {
    startDate: values.startDate || null,
    endDate: values.endDate || null,
    opensAt: values.opensAt || null,
    closesAt: values.closesAt || null,
  }
  const preview = formatSchedule(schedule)
  const days = eventDays(schedule)
  const err = (name: keyof Form) => formState.errors[name]?.message

  async function onSubmit(form: Form) {
    setError(null)
    // Blank fields as null, as the API stores them.
    const body = eventDetailsSchema.parse(form)
    const res = await api.PUT("/api/organizer/events/{id}/details", { params: { path: { id: setup.id } }, body })
    if (!res.data) {
      const { message, details } = saveError(res.error)
      const fields = details.filter((d) => fieldNames.includes(d.path as keyof Form))
      for (const d of fields) setFieldError(d.path as keyof Form, { message: d.message })
      return setError(fields.length ? "Check the highlighted fields" : message)
    }
    saved(res.data)
    reset(defaults(res.data))
    toast.success("Details saved")
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_300px] md:items-start md:gap-8">
      <div className="flex flex-col gap-6">
        <SetupPanel title="About the event">
          <Field label="Event name" htmlFor="name" error={err("name")}>
            <Input id="name" aria-invalid={!!err("name")} {...register("name")} />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-label">Event type</legend>
            <Controller
              control={control}
              name="eventTypeId"
              render={({ field }) => <EventTypeChips name="eventTypeId" types={setup.eventTypes} value={field.value} onChange={field.onChange} />}
            />
            <p className="text-help text-muted">You can change the type until the event is announced.</p>
          </fieldset>
          <Field label="Description" htmlFor="description" error={err("description")}>
            <Textarea id="description" {...register("description")} />
          </Field>
          <CoverField
            url={coverUrl}
            alt="Event cover"
            onUploaded={(file) => {
              setCovers((m) => ({ ...m, [file.id]: file.url }))
              setValue("coverFileId", file.id, { shouldDirty: true })
            }}
            onRemove={() => setValue("coverFileId", null, { shouldDirty: true })}
          />
        </SetupPanel>

        <SetupPanel title="Dates and hours" intro="For a market over several days, pick a later end date. Up to 7 days in a row, with the same hours every day.">
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <Field label="Start date" htmlFor="startDate" error={err("startDate")}>
              <Input id="startDate" type="date" aria-invalid={!!err("startDate")} {...register("startDate")} />
            </Field>
            <Field label="End date" htmlFor="endDate" error={err("endDate")}>
              <Input id="endDate" type="date" aria-invalid={!!err("endDate")} {...register("endDate")} />
            </Field>
            <Field label="Opens" htmlFor="opensAt" error={err("opensAt")}>
              <Input id="opensAt" type="time" step={FIVE_MINUTES} aria-invalid={!!err("opensAt")} {...register("opensAt")} />
            </Field>
            <Field label="Closes" htmlFor="closesAt" error={err("closesAt")}>
              <Input id="closesAt" type="time" step={FIVE_MINUTES} aria-invalid={!!err("closesAt")} {...register("closesAt")} />
            </Field>
          </div>
          <div className="flex items-start gap-3 rounded-md bg-sunken px-4 py-3.5">
            <CalendarBlankIcon aria-hidden="true" className="mt-0.5 size-5 flex-none text-muted" />
            <div>
              <p className="text-label font-semibold">
                {preview && days > 0 && days <= 7 ? `Runs ${days} ${days === 1 ? "day" : "days"}: ${preview}` : "Pick the dates and hours"}
              </p>
              <p className="text-cap text-muted">
                Vendors book the whole event and pay once. Closing time must be on the same day. Changing dates or hours later emails vendors who applied.
              </p>
            </div>
          </div>
        </SetupPanel>

        <SetupPanel title="Venue">
          <Field label="Venue name" htmlFor="venueName" error={err("venueName")}>
            <Input id="venueName" {...register("venueName")} />
          </Field>
          <Field label="Address" htmlFor="addressLine" error={err("addressLine")}>
            <Input id="addressLine" autoComplete="street-address" {...register("addressLine")} />
          </Field>
          <Field label="City" htmlFor="city" error={err("city")}>
            <select id="city" className={cn(inputClass, "h-11 md:max-w-80")} {...register("city")}>
              <option value="">Pick a city</option>
              {eventCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </SetupPanel>

        <SetupPanel title="For vendors" intro="Shown to signed-in vendors only. Visitors never see these.">
          <Field label="Contact details for vendors" htmlFor="vendorContactInfo" help="For example, a number to text or a group chat link." error={err("vendorContactInfo")}>
            <Textarea id="vendorContactInfo" className="min-h-18" {...register("vendorContactInfo")} />
          </Field>
          <div className="flex flex-col gap-5 md:grid md:grid-cols-2 md:gap-4">
            <Field label="Applications close" optional htmlFor="applicationsCloseAt" help="After this, vendors can't apply. Must be before the event starts." error={err("applicationsCloseAt")}>
              <Input id="applicationsCloseAt" type="datetime-local" step={FIVE_MINUTES} aria-invalid={!!err("applicationsCloseAt")} {...register("applicationsCloseAt")} />
            </Field>
            <Field label="Ingress details" optional htmlFor="ingressInfo" help="When and where vendors set up. Shown to vendors with a slot." error={err("ingressInfo")}>
              <Input id="ingressInfo" placeholder="From 3 PM, Gate 2" {...register("ingressInfo")} />
            </Field>
          </div>
        </SetupPanel>

        <TabSaveBar label="Save details" saving={formState.isSubmitting} dirty={formState.isDirty} error={error} />
      </div>

      <aside className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-lg bg-sunken p-4">
          <p className="text-label">How vendors will see it</p>
          <p className="text-sm">{preview ?? "Dates not set yet"}</p>
          <p className="text-cap text-muted">
            A Friday to Sunday market shows as &quot;Fri, Jan 15 to Sun, Jan 17 · 5 PM to 11 PM daily&quot;, and appears on each of its days in the calendar.
          </p>
        </div>
      </aside>
    </form>
  )
}
