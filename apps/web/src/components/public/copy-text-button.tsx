"use client"

import { CopyIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

// Copies a value, such as the support address, in one tap (design brief §14).
export function CopyTextButton({ text, label, done }: { text: string; label: string; done: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(done)
    } catch {
      toast.error("Couldn't copy it. Select the text and copy it instead.")
    }
  }
  return (
    <Button type="button" variant="secondary" onClick={copy}>
      <CopyIcon aria-hidden="true" />
      {label}
    </Button>
  )
}
