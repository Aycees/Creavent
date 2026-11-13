"use client"

import type { MeResponse, OnboardingState } from "@creavent/shared"
import { CheckCircleIcon, CircleIcon } from "@phosphor-icons/react"
import Link from "next/link"

import { Alert } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Step, Steps } from "@/components/ui/steps"
import { TextLink } from "@/components/ui/text-link"
import { usePublicConfig } from "@/lib/queries"
import { initialsOf } from "@/lib/shell-user"

// After the vendor flow (spec §1.1): profile preview, events, and a "Finish
// your profile" checklist.
export function VendorDone({ me, state }: { me: MeResponse; state: OnboardingState }) {
  const v = state.vendor
  const names = state.categories.filter((c) => v?.categoryIds.includes(c.id)).map((c) => c.name)
  const checklist = [
    { label: "Shop name and categories", done: Boolean(v?.shopName && v.categoryIds.length) },
    { label: "Contact number", done: Boolean(state.phone) },
    { label: "Email confirmed", done: true },
    { label: "Social link", done: Boolean(v?.socialLinks.length) },
    { label: `Add a logo and more photos (${v?.photos.length ?? 0} of 8)`, done: Boolean(state.avatar && (v?.photos.length ?? 0) > 0) },
  ]
  const doneCount = checklist.filter((c) => c.done).length

  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-h1">Your shop is ready, {me.fullName.split(" ")[0]}</h1>
          <p className="text-body text-muted">
            Organizers see this profile when you apply.
            {v?.slug && (
              <>
                {" "}
                Shoppers see it on your <TextLink href={`/vendors/${v.slug}`}>public vendor page</TextLink>.
              </>
            )}
          </p>
        </div>
        <section className="flex flex-col gap-3">
          <h2 className="text-h3">Events looking for {names[0]?.toLowerCase() ?? "your categories"}</h2>
          <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
            No events are open to vendors yet. We&apos;ll list them here, soonest first, when organizers open them.
          </p>
        </section>
        <Button asChild className="self-start">
          <Link href="/vendor">Go to your dashboard</Link>
        </Button>
      </div>
      <aside className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              {state.avatar && <AvatarImage src={state.avatar.url} alt="" />}
              <AvatarFallback>{initialsOf(v?.shopName ?? me.fullName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-h3">{v?.shopName}</p>
              <p className="text-cap text-muted">{names.join(" · ")}</p>
            </div>
          </div>
          {v?.description && <p className="text-sm">{v.description}</p>}
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-label font-semibold">Finish your profile</p>
            <span className="text-cap text-muted">
              {doneCount} of {checklist.length} done
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-sm">
                {c.done ? (
                  <CheckCircleIcon aria-hidden="true" weight="fill" className="size-5 text-success" />
                ) : (
                  <CircleIcon aria-hidden="true" className="size-5 text-subtle" />
                )}
                <span className={c.done ? "text-muted line-through" : ""}>{c.label}</span>
                <span className="sr-only">{c.done ? ", done" : ", to do"}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-cap text-muted">
          Permits like a barangay clearance are uploaded when you apply, because each event asks for different ones.
        </p>
      </aside>
    </div>
  )
}

const manila = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

// After the organizer flow: pending review, or a reminder to get approved.
export function OrganizerDone({ state }: { state: OnboardingState }) {
  const o = state.organizer
  const config = usePublicConfig()
  if (!o) return null
  const pending = o.approvalStatus === "pending_review"

  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start gap-3">
          <Badge tone={pending ? "warning" : "neutral"}>{pending ? "Pending review" : "Not submitted"}</Badge>
          <h1 className="text-h1">{pending ? "Thanks, we're on it" : "Your organizer page is set up"}</h1>
          <p className="text-body text-muted">
            {pending
              ? `We'll email ${o.contactEmail} within 1 to 2 business days. You can set up events while you wait.`
              : "Get approved when you're ready. You can build draft events in the meantime, and open them to vendors once approved."}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Link href="/organizer/events/new" className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 no-underline hover:border-border-strong">
            <span className="text-label font-semibold text-ink">Create your first event as a draft</span>
            <span className="text-sm text-muted">Add slots, prices and your policy now. Open it to vendors once approved.</span>
          </Link>
          {o.slug && (
            <Link href={`/organizers/${o.slug}`} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 no-underline hover:border-border-strong">
              <span className="text-label font-semibold text-ink">Preview your organizer page</span>
              <span className="text-sm text-muted">See how shoppers and vendors will see you.</span>
            </Link>
          )}
          {!pending && (
            <Button asChild variant="brand" className="self-start">
              <Link href="/organizer/approval">Get approved</Link>
            </Button>
          )}
        </div>
        {config.data && (
          <p className="text-sm text-muted">
            Questions about your review? Email <a className="text-ink underline" href={`mailto:${config.data.supportEmail}`}>{config.data.supportEmail}</a>
          </p>
        )}
        <Button asChild variant="secondary" className="self-start">
          <Link href="/organizer">Go to dashboard</Link>
        </Button>
      </div>
      {pending && (
        <aside className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
          <p className="text-label font-semibold">What happens next</p>
          <Steps>
            <Step state="done" title="Submitted">
              {o.approvalSubmittedAt && `${manila.format(new Date(o.approvalSubmittedAt))} · ${o.socialLinks.length} links`}
            </Step>
            <Step state="now" title="Creavent reviews your pages">
              Usually within 1 to 2 business days. We may call you.
            </Step>
            <Step state="todo" title="Approved by Creavent">
              The badge shows on your page and events, and you can open events to vendors.
            </Step>
          </Steps>
          <Alert tone="info">If we need better links, you&apos;ll see the reason here and can resubmit.</Alert>
        </aside>
      )}
    </div>
  )
}
