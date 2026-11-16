"use client"

import type { EventSetup } from "@creavent/shared"
import { ArrowCounterClockwiseIcon, DotsThreeIcon, EyeIcon, GlobeSimpleIcon, LockSimpleIcon, LockSimpleOpenIcon, TrashIcon, XCircleIcon } from "@phosphor-icons/react"
import Link from "next/link"
import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { api } from "@/lib/api"

import { CancelEventDialog, useUndoAnnounce } from "./lifecycle-controls"
import { DeleteDraftDialog } from "./open-controls"
import { saveError, useSetupSaved } from "./queries"

// Everything but the next step, out of the way (mockup OrgEventSetup, Phase 4
// polish): previews, opening or closing applications, and the destructive
// action, set apart at the bottom.
export function EventActionsMenu({ setup }: { setup: EventSetup }) {
  const saved = useSetupSaved(setup.id)
  const [dialog, setDialog] = React.useState<"cancel" | "delete" | null>(null)
  const live = setup.status === "open_to_vendors" || setup.status === "announced"
  const isPublic = setup.status === "announced" || setup.status === "completed"
  const undo = useUndoAnnounce(setup)
  // The time is read when the menu opens, not while rendering; the API
  // refuses a late undo anyway.
  const [openedAt, setOpenedAt] = React.useState(0)
  const canUndo = setup.undoAnnounceUntil !== null && Date.parse(setup.undoAnnounceUntil) > openedAt

  // Close or reopen applications (spec §3.3).
  async function toggleApplications() {
    const open = !setup.applicationsOpen
    const res = await api.PUT("/api/organizer/events/{id}/applications", { params: { path: { id: setup.id } }, body: { open } })
    if (!res.data) return toast.error(saveError(res.error).message)
    saved(res.data)
    toast.success(open ? "Applications open" : "Applications closed")
  }

  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && setOpenedAt(Date.now())}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="secondary" size="icon" aria-label="More actions">
            <DotsThreeIcon aria-hidden="true" weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem asChild>
            <Link href={`/events/${setup.slug}?preview=vendor`}>
              <EyeIcon aria-hidden="true" />
              Preview as vendor
            </Link>
          </DropdownMenuItem>
          {isPublic && (
            <DropdownMenuItem asChild>
              <Link href={`/events/${setup.slug}`}>
                <GlobeSimpleIcon aria-hidden="true" />
                See the public page
              </Link>
            </DropdownMenuItem>
          )}
          {canUndo && (
            <DropdownMenuItem onSelect={undo}>
              <ArrowCounterClockwiseIcon aria-hidden="true" />
              Undo announce
            </DropdownMenuItem>
          )}
          {live && (
            <DropdownMenuItem onSelect={toggleApplications}>
              {setup.applicationsOpen ? <LockSimpleIcon aria-hidden="true" /> : <LockSimpleOpenIcon aria-hidden="true" />}
              {setup.applicationsOpen ? "Close applications" : "Open applications"}
            </DropdownMenuItem>
          )}
          {(setup.status === "draft" || live) && <DropdownMenuSeparator />}
          {setup.status === "draft" && (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
              <TrashIcon aria-hidden="true" />
              Delete draft
            </DropdownMenuItem>
          )}
          {live && (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}>
              <XCircleIcon aria-hidden="true" />
              Cancel event
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {setup.status === "draft" && <DeleteDraftDialog setup={setup} open={dialog === "delete"} onOpenChange={(o) => setDialog(o ? "delete" : null)} />}
      {live && <CancelEventDialog setup={setup} open={dialog === "cancel"} onOpenChange={(o) => setDialog(o ? "cancel" : null)} />}
    </>
  )
}
