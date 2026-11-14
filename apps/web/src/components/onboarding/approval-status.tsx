"use client"

import { REVIEW_TARGET_TEXT } from "@creavent/shared"
import Link from "next/link"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useOnboardingState } from "./onboarding-flow"
import { OrganizerApprovalForm } from "./organizer-steps"
import { StepSavedContext } from "./use-save"

const manila = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })

// /organizer/approval (flow 2): the approval status, and the request form
// when there is nothing waiting for review.
export function ApprovalStatus() {
  const { data: state } = useOnboardingState()
  if (!state) return <p role="status" className="text-sm text-muted">Loading…</p>
  const o = state.organizer
  if (!o) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-h1">Get approved</h1>
        <p className="text-body text-muted">Set up your organizer page first.</p>
        <Button asChild>
          <Link href="/onboarding?role=organizer">Set up your organizer page</Link>
        </Button>
      </div>
    )
  }
  if (o.approvalStatus === "approved") {
    return (
      <div className="flex flex-col items-start gap-3">
        <Badge tone="success">Approved by Creavent</Badge>
        <h1 className="text-h1">You&apos;re approved</h1>
        <p className="text-body text-muted">Your organizer page and events show the badge, and you can open events to vendors.</p>
      </div>
    )
  }
  if (o.approvalStatus === "pending_review") {
    return (
      <div className="flex flex-col items-start gap-3">
        <Badge tone="warning">Pending review</Badge>
        <h1 className="text-h1">We&apos;re reviewing your pages</h1>
        <p className="text-body text-muted">
          {o.approvalSubmittedAt && <>Submitted {manila.format(new Date(o.approvalSubmittedAt))}. </>}
          Reviews usually take {REVIEW_TARGET_TEXT}. We&apos;ll email {o.contactEmail}.
        </p>
        <Alert tone="info">You can build draft events while you wait.</Alert>
      </div>
    )
  }
  return (
    <StepSavedContext.Provider value={() => {}}>
      <div className="max-w-[600px]">
        <OrganizerApprovalForm state={state} onBack={() => history.back()} finishLater={null} allowLater={false} />
      </div>
    </StepSavedContext.Provider>
  )
}
