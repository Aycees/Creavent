import type { ProfileEvent, PublicOrganizerPage } from "@creavent/shared"
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"

import { cardGrid, EventCard } from "@/components/listing/listing-view"
import { ApprovedMark } from "@/components/ui/approved-mark"
import { Badge } from "@/components/ui/badge"
import { DateStamp } from "@/components/ui/date-stamp"
import { eventDays, stampDate } from "@/lib/event-format"
import { initialsOf } from "@/lib/shell-user"
import { cn } from "@/lib/utils"

import { SocialLinks } from "./social-links"

export const joinedMonth = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "long",
    year: "numeric",
  }).format(new Date(iso))

// A past event as a row: a gray month on the stamp, since ember means "now"
// (design brief §3).
export function PastRow({ e, detail, trailing, upcoming = false }: { e: ProfileEvent; detail: string; trailing?: React.ReactNode; upcoming?: boolean }) {
  const days = eventDays(e)
  return (
    <li className="border-b border-border last:border-b-0">
      <Link href={`/events/${e.slug}`} className="flex min-h-19 items-center gap-4 px-4 py-3.5 text-ink no-underline md:px-5">
        {e.startDate && (
          <DateStamp
            date={stampDate(e.startDate)}
            endDay={days > 1 && e.endDate ? Number(e.endDate.slice(8)) : undefined}
            className={cn("h-12 w-11 [&_[data-day]]:text-[19px] [&_[data-sub]]:hidden", !upcoming && "[&_[data-month]]:text-muted")}
          />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[16px] leading-[22px] font-semibold">{e.name}</span>
          <span className="text-sm text-muted">{detail}</span>
          {upcoming && (
            <span className="mt-1">
              <Badge tone="info">Upcoming</Badge>
            </span>
          )}
        </span>
        {trailing}
        <CaretRightIcon aria-hidden="true" className="size-5 flex-none text-muted" />
      </Link>
    </li>
  )
}

// /organizers/[slug] (spec §7.1, mockup OrganizerP4). No contact form.
export function OrganizerPageView({ page, supportEmail }: { page: PublicOrganizerPage; supportEmail: string }) {
  const o = page.organizer
  return (
    <article className="flex flex-col gap-12 md:gap-14">
      <section className="flex flex-col gap-6 md:flex-row md:flex-wrap md:items-start md:gap-x-14 md:gap-y-8">
        <div className="flex min-w-0 flex-col gap-4 md:flex-[999_1_560px] md:flex-row md:gap-7">
          {o.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized
            <img src={o.logoUrl} alt="" className="size-22 flex-none rounded-pill object-cover md:size-28" />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-22 flex-none place-items-center rounded-pill bg-inverse text-[28px] font-semibold text-on-inverse md:size-28 md:text-[36px]"
            >
              {initialsOf(o.displayName)}
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-3.5">
            <h1 className="text-display text-balance">{o.displayName}</h1>
            {o.approved && <ApprovedMark className="min-h-11 md:min-h-0" />}
            {o.about && <p className="max-w-[640px] whitespace-pre-line text-pretty md:text-body-lg">{o.about}</p>}
            <SocialLinks links={o.socialLinks} />
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 md:flex md:max-w-[380px] md:flex-[1_1_300px] md:flex-col md:gap-0 md:rounded-lg md:border md:border-border md:bg-surface md:px-5 md:py-2">
          <div className="rounded-md bg-sunken p-3 md:flex md:items-center md:justify-between md:rounded-none md:border-b md:border-border md:bg-transparent md:px-0 md:py-3">
            <dt className="text-cap text-muted md:text-sm">Events held on Creavent</dt>
            <dd className="text-price tabular-nums">{o.eventsHeld}</dd>
          </div>
          <div className="rounded-md bg-sunken p-3 md:flex md:items-center md:justify-between md:rounded-none md:border-b md:border-border md:bg-transparent md:px-0 md:py-3">
            <dt className="text-cap text-muted md:text-sm">City</dt>
            <dd className="text-label">{o.city ?? "Not set"}</dd>
          </div>
          {/* Phones: the joined line takes the full row, so it stays on one line. */}
          <div className="col-span-2 rounded-md bg-sunken p-3 md:flex md:items-center md:justify-between md:rounded-none md:bg-transparent md:px-0 md:py-3">
            <dt className="sr-only">Joined</dt>
            <dd className="text-cap md:text-label">{`On Creavent since ${joinedMonth(o.joinedAt)}`}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="up-h" className="flex flex-col gap-4 md:gap-5">
        <h2 id="up-h" className="text-h3 md:text-h2">
          Upcoming
        </h2>
        {page.upcoming.length ? (
          <ul className={cardGrid(page.upcoming.length)}>
            {page.upcoming.map((e) => (
              <EventCard key={e.slug} e={e} />
            ))}
          </ul>
        ) : (
          <p className="text-muted">No upcoming events announced yet.</p>
        )}
      </section>

      {page.past.length > 0 && (
        <section aria-labelledby="past-h" className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3">
            <h2 id="past-h" className="text-h3 md:text-h2">
              Past events
            </h2>
            <span className="text-sm text-muted">{`${page.past.length} completed`}</span>
          </div>
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {page.past.map((e) => (
              <PastRow
                key={e.slug}
                e={e}
                detail={[e.startDate?.slice(0, 4), eventDays(e) > 1 ? `${eventDays(e)} days` : null, e.venueName].filter(Boolean).join(" · ")}
                trailing={
                  <span className="hidden md:inline-flex">
                    <Badge dot={false}>{e.typeName}</Badge>
                  </span>
                }
              />
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-muted">
        Something wrong with this organizer? Email{" "}
        <a href={`mailto:${supportEmail}`} className="text-ink underline underline-offset-2">
          {supportEmail}
        </a>{" "}
        and we&apos;ll look into it.
      </p>
    </article>
  )
}
