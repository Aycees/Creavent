"use client"

import { acceptLegalSchema, type AcceptLegalInput } from "@creavent/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import * as React from "react"
import { useForm } from "react-hook-form"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { homePath, meQueryKey } from "@/lib/queries"
import { AgreementBoxes } from "./agreement-boxes"

// /account/legal: shown before any other page when the terms or privacy notice
// changed, or after a Google signup, which has no checkboxes (spec §1).
export function LegalForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [failed, setFailed] = React.useState(false)
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AcceptLegalInput>({ resolver: zodResolver(acceptLegalSchema) })

  async function onSubmit(values: AcceptLegalInput) {
    const { data: me } = await api.POST("/api/me/legal", { body: values })
    if (!me) return setFailed(true)
    queryClient.setQueryData(meQueryKey, me)
    router.replace(homePath(me))
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <AgreementBoxes control={control} errors={errors} />
      {failed && <Alert tone="danger">Something went wrong. Try again.</Alert>}
      <Button type="submit" disabled={isSubmitting}>
        Accept and continue
      </Button>
    </form>
  )
}
