"use client"

import { Controller, type Control, type FieldErrors } from "react-hook-form"

import { Checkbox } from "@/components/ui/checkbox"
import { TextLink } from "@/components/ui/text-link"

type Agreements = { ageConfirmed: true; acceptLegal: true }

// The age confirmation and the terms and privacy acceptance (spec §1), on the
// signup form and on /account/legal.
export function AgreementBoxes<T extends Agreements>({
  control,
  errors,
}: {
  control: Control<T>
  errors: FieldErrors<T>
}) {
  const c = control as unknown as Control<Agreements>
  const e = errors as FieldErrors<Agreements>
  return (
    <div className="flex flex-col gap-1 rounded-md bg-sunken px-3.5 py-2">
      <Controller
        control={c}
        name="ageConfirmed"
        render={({ field }) => (
          <label className="flex min-h-11 items-center gap-2.5 text-sm">
            <Checkbox checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true)} />
            <span>I&apos;m 18 or older</span>
          </label>
        )}
      />
      {e.ageConfirmed && <p className="text-help text-danger-ink">{e.ageConfirmed.message}</p>}
      <Controller
        control={c}
        name="acceptLegal"
        render={({ field }) => (
          <label className="flex min-h-11 items-center gap-2.5 text-sm">
            <Checkbox checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true)} />
            <span>
              I agree to the <TextLink href="/terms">Terms of use</TextLink> and{" "}
              <TextLink href="/privacy">Privacy notice</TextLink>
            </span>
          </label>
        )}
      />
      {e.acceptLegal && <p className="text-help text-danger-ink">{e.acceptLegal.message}</p>}
    </div>
  )
}
