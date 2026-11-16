"use client"

import { LinkSimpleIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

// "Copy link" on public pages: links are shared in Facebook groups (sitemap §1).
export function CopyLinkButton({ className }: { className?: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href.split("?")[0]!)
      toast.success("Link copied")
    } catch {
      toast.error("Couldn't copy the link. Copy it from the address bar.")
    }
  }
  return (
    <Button type="button" variant="secondary" block className={className} onClick={copy}>
      <LinkSimpleIcon aria-hidden="true" />
      Copy link
    </Button>
  )
}
