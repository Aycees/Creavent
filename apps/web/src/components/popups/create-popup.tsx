"use client"

import { createPopupSchema, type CreatePopupInput } from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { useForm } from "react-hook-form"

import { SetupPanel } from "@/components/events/parts"
import { saveError } from "@/components/events/queries"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { popupsKey } from "./queries"

// /vendor/popups/new: a pop-up draft starts from a name, before host
// approval (spec §4.7). Everything else is on its form.
export function CreatePopup() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [error, setError] = React.useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<CreatePopupInput>({
    resolver: zodResolver(createPopupSchema),
    defaultValues: { name: "" },
  })

  async function onSubmit(body: CreatePopupInput) {
    setError(null)
    const res = await api.POST("/api/vendor/popups", { body })
    if (!res.data) return setError(saveError(res.error).message)
    await queryClient.invalidateQueries({ queryKey: popupsKey })
    router.push(`/vendor/popups/${res.data.id}`)
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex max-w-160 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">Host a pop-up</h1>
        <p className="text-sm text-muted">Start with a name. You add the dates, venue and a cover next. Only you can see a draft.</p>
      </div>

      <SetupPanel title="About the pop-up">
        <Field label="Pop-up name" htmlFor="name" error={formState.errors.name?.message} help="For example, Lola's Ukay at Habi Café">
          <Input id="name" aria-invalid={!!formState.errors.name} {...register("name")} />
        </Field>
      </SetupPanel>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex gap-3">
        <Button type="submit" disabled={formState.isSubmitting} className="flex-1 md:flex-none md:px-7">
          Create draft
        </Button>
        <Button asChild variant="ghost">
          <Link href="/vendor/popups">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
