"use client"

import { createEventSchema, type CreateEventInput } from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { Controller, useForm } from "react-hook-form"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { EventTypeChips, SetupPanel } from "./parts"
import { saveError, useEventTypes } from "./queries"

const NOT_ONBOARDED = "Finish your organizer page and contact number first"

// /organizer/events/new: a draft starts from a name and a type. Everything
// else is filled on the setup page (decided 2026-11-14).
export function CreateEvent() {
  const router = useRouter()
  const { data: types, isError } = useEventTypes()
  const [error, setError] = React.useState<string | null>(null)
  const { register, control, handleSubmit, formState, reset } = useForm<CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: { name: "", eventTypeId: "" },
  })

  React.useEffect(() => {
    if (types?.[0]) reset({ name: "", eventTypeId: types[0].id }, { keepDirtyValues: true })
  }, [types, reset])

  async function onSubmit(body: CreateEventInput) {
    setError(null)
    const res = await api.POST("/api/organizer/events", { body })
    if (!res.data) return setError(saveError(res.error).message)
    router.push(`/organizer/events/${res.data.id}`)
  }

  if (isError) return <Alert tone="danger">We couldn&apos;t load this page. Refresh to try again.</Alert>
  if (!types) return <p role="status" className="text-sm text-muted">Loading…</p>

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex max-w-160 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">Create event</h1>
        <p className="text-sm text-muted">Start with a name. You fill in the dates, venue, slots and payments next. Only you can see a draft.</p>
      </div>

      <SetupPanel title="About the event">
        <Field label="Event name" htmlFor="name" error={formState.errors.name?.message} help="For example, Matina Night Flea, January">
          <Input id="name" aria-invalid={!!formState.errors.name} {...register("name")} />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label">Event type</legend>
          <Controller
            control={control}
            name="eventTypeId"
            render={({ field }) => <EventTypeChips name="eventTypeId" types={types} value={field.value} onChange={field.onChange} />}
          />
          <p className="text-help text-muted">You can change the type until the event is announced.</p>
        </fieldset>
      </SetupPanel>

      {error && (
        <Alert tone="danger">
          <span>
            {error}
            {error === NOT_ONBOARDED && (
              <>
                {" "}
                <Link href="/onboarding?role=organizer" className="underline underline-offset-2">
                  Finish onboarding
                </Link>
              </>
            )}
          </span>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={formState.isSubmitting} className="flex-1 md:flex-none md:px-7">
          Create draft
        </Button>
        <Button asChild variant="ghost">
          <Link href="/organizer">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
