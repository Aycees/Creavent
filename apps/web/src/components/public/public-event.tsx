import type * as React from "react"
import type { PublicEvent } from "@creavent/shared"
import { ClockIcon, MapPinIcon, NavigationArrowIcon, StorefrontIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"

import { Alert } from "@/components/ui/alert"
import { ApprovedMark } from "@/components/ui/approved-mark"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateStamp } from "@/components/ui/date-stamp"
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder"
import { initialsOf } from "@/lib/shell-user"
import { eventDays, formatDay, formatSchedule, formatTime, stampDate } from "@/lib/event-format"

import { CopyLinkButton } from "./copy-link-button"
import { SocialLinks } from "./social-links"
import { VendorList } from "./vendor-list"

type Schedule = Pick<PublicEvent, "startDate" | "endDate" | "opensAt" | "closesAt">

const longDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "short",
  day: "numeric",
})
const manilaDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  weekday: "short",
  month: "short",
  day: "numeric",
})

// The detail page lines (design brief §4): "Saturday, Nov 14" and "5 PM to
// 11 PM", or "Fri, Nov 20 to Sun, Nov 22" and "9 AM to 5 PM daily".
function detailLines(s: Schedule) {
  if (!s.startDate || !s.endDate || !s.opensAt || !s.closesAt) return null
  const hours = `${formatTime(s.opensAt)} to ${formatTime(s.closesAt)}`
  if (s.startDate === s.endDate) return { day: longDay.format(new Date(`${s.startDate}T00:00:00Z`)), hours }
  return {
    day: `${formatDay(s.startDate)} to ${formatDay(s.endDate)}`,
    hours: `${hours} daily`,
  }
}

function Stamp({ s, size, past }: { s: Schedule; size?: "sm" | "md" | "lg"; past?: boolean }) {
  if (!s.startDate) return null
  const days = eventDays(s)
  return (
    <DateStamp
      date={stampDate(s.startDate)}
      endDay={days > 1 && s.endDate ? Number(s.endDate.slice(8)) : undefined}
      size={size}
      className={past ? "[&_[data-month]]:text-muted" : undefined}
    />
  )
}

// Google Maps from the pin when the organizer set one, else the address.
export function directionsUrl(e: Pick<PublicEvent, "latitude" | "longitude" | "venueName" | "addressLine" | "city">) {
  const query = e.latitude !== null && e.longitude !== null ? `${e.latitude},${e.longitude}` : [e.venueName, e.addressLine, e.city].filter(Boolean).join(", ")
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null
}

// The organizer, or a pop-up's host shop, linked to their page when it's up.
function HostName({ name, href }: { name: string; href: string | null }) {
  return href ? (
    <Link href={href} className="font-semibold">
      {name}
    </Link>
  ) : (
    <span className="font-semibold">{name}</span>
  )
}

const joined = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", year: "numeric" })

// A pop-up's host block, in place of the organizer card (spec §4.7, §7,
// mockup P6PopupEvent).
function HostBlock({ host: h }: { host: NonNullable<PublicEvent["host"]> }) {
  const href = h.slug ? `/vendors/${h.slug}` : null
  const shown = h.photos.slice(0, 3)
  return (
    <section aria-label="Hosted by" className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface p-5">
      <p className="text-cap font-semibold text-muted uppercase">Hosted by</p>
      <div className="flex items-center gap-3">
        <Avatar size="lg">
          {h.avatarUrl && <AvatarImage src={h.avatarUrl} alt="" />}
          <AvatarFallback>{initialsOf(h.shopName)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <HostName name={h.shopName} href={href} />
          {h.approved && <ApprovedMark />}
        </div>
      </div>
      <p className="text-sm text-muted">
        {`Joined ${joined.format(new Date(h.joinedAt))}${h.eventsSoldAt > 0 ? ` · Sold at ${h.eventsSoldAt} Creavent ${h.eventsSoldAt === 1 ? "event" : "events"}` : ""}`}
      </p>
      {h.categories.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {h.categories.map((c) => (
            <li key={c}>
              <Badge dot={false}>{c}</Badge>
            </li>
          ))}
        </ul>
      )}
      {h.products && (
        <p className="text-sm">
          <span className="text-muted">Sells </span>
          <span>{h.products}</span>
        </p>
      )}
      {shown.length > 0 && (
        <ul className="grid grid-cols-3 gap-1.5">
          {shown.map((url, i) => (
            <li key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
              <img src={url} alt="" loading="lazy" className="aspect-square w-full rounded-sm object-cover" />
              {i === shown.length - 1 && h.photos.length > shown.length && (
                <span className="absolute inset-0 grid place-items-center rounded-sm bg-ink/55 text-label text-on-inverse">{`+${h.photos.length - shown.length}`}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <SocialLinks links={h.socialLinks} />
      {href && (
        <Button asChild variant="secondary" block>
          <Link href={href}>{`See ${h.shopName}'s page`}</Link>
        </Button>
      )}
    </section>
  )
}

// /events/[slug] for visitors (sitemap §3, mockup EventP4). Rendered on the
// server and cached (decision Q1), so it has no viewer-specific parts.
export function PublicEventView({ event: e, supportEmail, report }: { event: PublicEvent; supportEmail: string; report?: React.ReactNode }) {
  const lines = detailLines(e)
  const days = eventDays(e)
  const ended = e.status === "completed"
  const canceled = e.status === "canceled"
  const directions = ended || canceled ? null : directionsUrl(e)
  const place = [e.addressLine, e.city].filter(Boolean).join(", ")
  const host = e.host
  const kind = host ? "pop-up" : "event"
  const byline = host
    ? { name: host.shopName, href: host.slug ? `/vendors/${host.slug}` : null, approved: host.approved }
    : { name: e.organizer!.displayName, href: e.organizer!.slug ? `/organizers/${e.organizer!.slug}` : null, approved: e.organizer!.approved }

  return (
    <article className="flex flex-col gap-6">
      {ended && e.startDate && (
        <Alert tone="info" className="bg-sunken text-ink">
          <span>
            <span className="font-semibold">{`This ${kind} has ended.`}</span> It took place {days > 1 ? "from" : "on"} {formatSchedule(e)?.split(" · ")[0]}.
          </span>
        </Alert>
      )}
      {canceled && e.canceled && (
        <Alert tone="danger">
          <span className="flex flex-col gap-1">
            <span>
              <span className="font-semibold">{host ? "This pop-up was canceled." : "This event is canceled."}</span>{" "}
              {host ? "The host" : "The organizer"} canceled it on {manilaDay.format(new Date(e.canceled.at))}. It won&apos;t take place on these dates.
            </span>
            {e.canceled.reason && (
              <span>
                <span className="font-semibold">{host ? `Note from ${host.shopName}:` : "Organizer's note:"}</span> <span>{e.canceled.reason}</span>
              </span>
            )}
          </span>
        </Alert>
      )}

      <header className="flex flex-col gap-2.5">
        <div className="flex animate-rise flex-wrap gap-2">
          <Badge dot={false}>{e.typeName}</Badge>
          {days > 1 && (
            <Badge tone="info" dot={false}>
              {`${days} days`}
            </Badge>
          )}
          {ended && <Badge>Completed</Badge>}
          {canceled && <Badge tone="danger">Canceled</Badge>}
        </div>
        <h1 className="max-w-[900px] animate-rise text-display text-balance">{e.name}</h1>
        <p className="flex animate-rise flex-wrap items-center gap-x-2 gap-y-1 text-body [--cv-delay:60ms]">
          <span>by</span> <HostName name={byline.name} href={byline.href} />
          {byline.approved && <ApprovedMark />}
        </p>
      </header>

      <div className="flex flex-col gap-8 md:grid md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-x-12">
        {/* Phones: the cover, then the summary card, so dates and directions
            are one scroll away, then the rest. Desktop: the summary stays beside the content. */}
        <aside className="flex flex-col gap-4 [--cv-delay:120ms] md:sticky md:top-6 md:col-start-2 md:row-span-2 md:row-start-1 md:animate-rise">
          <section aria-label="When and where" className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 md:p-6 md:shadow-md">
            <div className="flex items-center gap-4">
              <Stamp s={e} size="lg" past={ended || canceled} />
              {lines ? (
                <div className="flex flex-col gap-0.5">
                  <p className={canceled ? "text-h3 text-muted line-through" : "text-h3"}>{lines.day}</p>
                  <p className="text-muted">{lines.hours}</p>
                </div>
              ) : (
                <p className="text-muted">Dates to be announced</p>
              )}
            </div>
            <hr className="border-border" />
            <ul className="flex flex-col gap-3.5">
              <li className="flex items-start gap-3">
                <MapPinIcon aria-hidden="true" className="mt-0.5 size-5 flex-none text-muted" />
                <span>
                  <span className="block font-semibold">{e.venueName ?? "Venue to be announced"}</span>
                  {place && <span className="text-sm text-muted">{place}</span>}
                </span>
              </li>
              {!canceled && !host && (
                <li className="flex items-start gap-3">
                  <StorefrontIcon aria-hidden="true" className="mt-0.5 size-5 flex-none text-muted" />
                  <span>{`${e.vendors.length} ${e.vendors.length === 1 ? "vendor" : "vendors"} confirmed`}</span>
                </li>
              )}
            </ul>
            {/* Phones: these two actions pin to the bottom of the screen (design brief §14), the same
                element, so each control still renders once. Ended and canceled events have no directions, so nothing pins. */}
            <div
              data-sticky-bar={directions ? "" : undefined}
              className={
                directions
                  ? "flex flex-col gap-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-10 max-md:flex-row max-md:gap-3 max-md:border-t max-md:border-border max-md:bg-surface max-md:px-4 max-md:pt-3 max-md:pb-5 max-md:shadow-up max-md:animate-sheet max-md:[--cv-delay:350ms] max-md:[&>*]:flex-1"
                  : "flex flex-col gap-2"
              }
            >
              {directions && (
                <Button asChild block>
                  <a href={directions} target="_blank" rel="noreferrer">
                    <NavigationArrowIcon aria-hidden="true" />
                    Get directions
                  </a>
                </Button>
              )}
              <CopyLinkButton />
            </div>
            <p className="text-cap text-subtle">Details updated {manilaDay.format(new Date(e.updatedAt))}</p>
          </section>

          {host ? (
            <HostBlock host={host} />
          ) : (
            <section aria-label="Organizer" className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface p-5">
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  {e.organizer!.logoUrl && <AvatarImage src={e.organizer!.logoUrl} alt="" />}
                  <AvatarFallback>{initialsOf(e.organizer!.displayName)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <HostName name={byline.name} href={byline.href} />
                  {byline.approved && <ApprovedMark />}
                </div>
              </div>
              {e.organizer!.about && <p className="line-clamp-3 text-sm text-muted">{e.organizer!.about}</p>}
              {e.organizer!.eventsHeld > 0 && (
                <p className="text-sm text-muted">{`${e.organizer!.eventsHeld} ${e.organizer!.eventsHeld === 1 ? "event" : "events"} held on Creavent`}</p>
              )}
              {byline.href && (
                <Button asChild variant="secondary" block>
                  <Link href={byline.href}>See organizer page</Link>
                </Button>
              )}
            </section>
          )}
        </aside>

        {/* On phones this column dissolves into the page's single column so the cover can lead. */}
        <div className="flex min-w-0 flex-col gap-10 max-md:contents md:col-start-1 md:row-start-1">
          <div className="animate-rise overflow-hidden rounded-xl [--cv-delay:120ms] max-md:order-first">
            {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
            {e.coverUrl ? <img src={e.coverUrl} alt="" fetchPriority="high" className="aspect-[3/2] w-full object-cover" /> : <PhotoPlaceholder ratio="3/2" />}
          </div>

          {e.description && (
            <section aria-labelledby="about-h" className="flex max-w-[680px] flex-col gap-3">
              <h2 id="about-h" className="text-h2">
                About
              </h2>
              <p className="text-body-lg whitespace-pre-line text-pretty">{e.description}</p>
            </section>
          )}

          {!canceled && !host && <VendorList vendors={e.vendors} title={ended ? "Who sold here" : "Who's selling"} />}

          {e.publicFloorPlanUrl && !canceled && !host && (
            <section aria-labelledby="fp-h" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="fp-h" className="text-h2">
                    Floor plan
                  </h2>
                  <p className="text-sm text-muted">Find a stall by its slot number.</p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <a href={e.publicFloorPlanUrl} target="_blank" rel="noreferrer">
                    Open full size
                  </a>
                </Button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
              <img src={e.publicFloorPlanUrl} alt="Floor plan with each vendor's slot" className="w-full rounded-lg border border-border" />
            </section>
          )}

          {report ?? (
            <p className="text-sm text-muted">
              {`Something wrong with this ${kind}?`} Email us at{" "}
              <a href={`mailto:${supportEmail}`} className="text-ink underline underline-offset-2">
                {supportEmail}
              </a>{" "}
              and we&apos;ll look into it.
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

// An event only open to vendors, for visitors (flow 10 edge case).
export function NotPublicView() {
  return (
    <div className="flex max-w-[560px] flex-col items-start gap-4 py-8">
      <span aria-hidden="true" className="grid size-14 place-items-center rounded-lg bg-sunken text-muted">
        <ClockIcon className="size-8" />
      </span>
      <h1 className="text-h1">This event isn&apos;t public yet</h1>
      <p className="text-body-lg">The organizer is still lining up vendors. The event shows up on Creavent once they announce it.</p>
      <Button asChild>
        <Link href="/">See upcoming events</Link>
      </Button>
      <div className="mt-4 flex w-full flex-col items-start gap-2.5 rounded-md bg-sunken p-4">
        <p className="text-label">Selling at this event?</p>
        <p className="text-sm text-muted">Vendors can see it, apply, and pay for a slot while it&apos;s open to vendors.</p>
        <Button asChild variant="secondary">
          <Link href="/login">Log in as a vendor</Link>
        </Button>
      </div>
    </div>
  )
}

// An event canceled before it was announced: its name and dates only, since
// it was never public (decision Q2).
export function CanceledNoticeView({ name, canceled, ...schedule }: Schedule & { name: string; canceled: PublicEvent["canceled"] }) {
  return (
    <div className="flex max-w-[560px] flex-col items-start gap-4 py-8">
      <Stamp s={schedule} past />
      <h1 className="text-h1">{`${name} was canceled`}</h1>
      {formatSchedule(schedule) && <p className="text-muted line-through">{formatSchedule(schedule)}</p>}
      {canceled?.reason && (
        <p>
          <span className="font-semibold">Organizer&apos;s note:</span> <span>{canceled.reason}</span>
        </p>
      )}
      <Button asChild>
        <Link href="/">Find another event</Link>
      </Button>
    </div>
  )
}
