"use client"

import { REVIEW_TARGET_TEXT, type HostApproval } from "@creavent/shared"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import * as React from "react"

import { LinksEditor, StepActions } from "@/components/onboarding/parts"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { usePublicConfig } from "@/lib/queries"
import { hostApprovalKey, manilaDay, popupsKey, useHostApproval } from "./queries"

const display = (link: string) => link.replace(/^https?:\/\//, "")

function Header({ badge, title, children }: { badge: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-cap font-semibold text-muted uppercase">Host approval</p>
      {badge}
      <h1 className="text-h1">{title}</h1>
      {children}
    </div>
  )
}

function KeepingNote() {
  return (
    <p className="text-help text-muted">
      After approval, changing your shop name or adding a new link sends it back for a quick review.
    </p>
  )
}

// /vendor/host-approval (spec §4.7, flow 12): approved once to host pop-ups,
// from the shop's social links. Mirrors /organizer/approval.
export function HostApprovalPage() {
  const { data: host, isError } = useHostApproval()
  const support = usePublicConfig().data?.supportEmail

  if (isError) return <Alert tone="danger">We couldn&apos;t load your host approval. Refresh to try again.</Alert>
  if (!host) return <p role="status" className="text-sm text-muted">Loading…</p>

  if (host.suspended) {
    return (
      <Header badge={<Badge tone="danger">Suspended</Badge>} title="Your vendor role is suspended">
        <p className="text-body text-muted">You can&apos;t request host approval while your vendor role is suspended.</p>
      </Header>
    )
  }

  if (host.status === "pending_review") {
    return (
      <div className="flex max-w-[600px] flex-col gap-6">
        <Header badge={<Badge tone="warning">Pending review</Badge>} title="We're checking your shop">
          <p className="text-body text-muted">
            {host.submittedAt && <>Submitted {manilaDay(host.submittedAt)}. </>}
            Reviews usually take {REVIEW_TARGET_TEXT}. We&apos;ll email you.
          </p>
        </Header>
        <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-label font-semibold">Links we&apos;re checking</h2>
          <ul aria-label="Links we're checking" className="flex flex-col gap-1 text-sm">
            {host.socialLinks.map((link) => (
              <li key={link} className="truncate">
                {display(link)}
              </li>
            ))}
          </ul>
        </section>
        <Alert tone="info">Keep working on your drafts. You can announce once you&apos;re approved.</Alert>
        <Button asChild variant="secondary" className="self-start">
          <Link href="/vendor/popups">Back to my pop-ups</Link>
        </Button>
      </div>
    )
  }

  if (host.status === "approved") {
    const on = host.decidedAt ? manilaDay(host.decidedAt) : null
    return (
      <div className="flex max-w-[600px] flex-col gap-6">
        <Header badge={<Badge tone="success">Approved by Creavent</Badge>} title="You can host pop-ups">
          <p className="text-body text-muted">
            {host.source === "earned"
              ? `Approved${on ? ` ${on}` : ""}, because you sold at a Creavent event.`
              : `Approved${on ? ` ${on}` : ""} after we reviewed your pages.`}
          </p>
        </Header>
        <section className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-label font-semibold">Keeping your approval</h2>
          <p className="text-sm text-muted">
            Changing your shop name or adding a new social link sends it back for a quick review. While we check, your
            announced pop-ups stay up but can&apos;t be edited.
          </p>
        </section>
        <Button asChild className="self-start">
          <Link href="/vendor/popups">Go to my pop-ups</Link>
        </Button>
      </div>
    )
  }

  // Not submitted, rejected, or revoked: the request form.
  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,600px)_280px] md:items-start md:gap-8">
      <div className="flex flex-col gap-6">
        {host.revoked ? (
          <Header badge={<Badge tone="danger">Revoked</Badge>} title="Your host approval was revoked">
            <Reason host={host} />
            <p className="text-body text-muted">Your announced pop-ups are hidden. You can still apply to and sell at other events.</p>
            <p className="text-body text-muted">
              To host again, resubmit your pages for review.
              {support && (
                <>
                  {" "}
                  If you think this is a mistake, email <a href={`mailto:${support}`}>{support}</a>.
                </>
              )}
            </p>
          </Header>
        ) : host.status === "rejected" ? (
          <Header badge={<Badge tone="danger">Not approved</Badge>} title="Add a bit more, then resubmit">
            <Reason host={host} />
          </Header>
        ) : (
          <Header badge={<Badge tone="neutral">Not submitted</Badge>} title="Get approved to host pop-ups">
            <p className="text-body text-muted">
              You do this once. Share pages that show your shop is real, like posts of your products or past stalls. We
              reply in {REVIEW_TARGET_TEXT}.
            </p>
          </Header>
        )}
        <RequestForm host={host} />
      </div>
      <aside className="flex flex-col gap-4 md:pt-10">
        <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-label font-semibold">What we check</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
            <li>Real products or past stalls in photos or posts</li>
            <li>Recent activity on the page</li>
            <li>The same shop name as on Creavent</li>
          </ul>
        </section>
        <section className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-label font-semibold">Selling at an event soon?</h2>
          <p className="text-sm text-muted">
            After you sell at a Creavent event that ends, you&apos;re approved automatically the next time you open Host a
            pop-up.
          </p>
        </section>
        <KeepingNote />
      </aside>
    </div>
  )
}

function Reason({ host }: { host: HostApproval }) {
  if (!host.rejectionReason) return null
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      {host.decidedAt && <p className="text-cap text-muted">From Creavent, {manilaDay(host.decidedAt)}</p>}
      <p className="text-body">&ldquo;{host.rejectionReason}&rdquo;</p>
    </div>
  )
}

function RequestForm({ host }: { host: HostApproval }) {
  const queryClient = useQueryClient()
  const [links, setLinks] = React.useState(host.socialLinks)
  const [linkError, setLinkError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const resubmit = host.status === "rejected"

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (links.length === 0) return setLinkError("Add at least one link")
    setLinkError(null)
    setError(null)
    setSaving(true)
    const res = await api.POST("/api/vendor/host-approval", { body: { socialLinks: links } })
    setSaving(false)
    if (!res.data) return setError((res.error as { message?: string } | undefined)?.message ?? "Something went wrong. Try again.")
    queryClient.setQueryData(hostApprovalKey, res.data)
    await queryClient.invalidateQueries({ queryKey: popupsKey })
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4 pb-24 md:pb-0">
      <div className="flex flex-col gap-2">
        <p className="text-label">
          Your shop&apos;s social pages <span className="font-normal text-muted">At least 1</span>
        </p>
        <LinksEditor
          id="host-link"
          label="Link to your shop's page"
          placeholder="instagram.com/yourshop"
          links={links}
          onChange={setLinks}
          error={linkError ?? undefined}
        />
        <p className="text-help text-muted">These links also show on your vendor page, so people can reach you.</p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <StepActions>
        <Button asChild variant="ghost" className="hidden md:inline-flex">
          <Link href="/vendor/popups">Back to my pop-ups</Link>
        </Button>
        <div className="hidden flex-1 md:block" />
        <Button type="submit" variant="brand" block className="md:w-auto md:px-7" disabled={saving}>
          {resubmit ? "Resubmit for review" : "Submit for review"}
        </Button>
      </StepActions>
    </form>
  )
}
