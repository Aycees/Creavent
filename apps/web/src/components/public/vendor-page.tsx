import type { PublicVendorPage } from "@creavent/shared"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { DateStamp } from "@/components/ui/date-stamp"
import { eventDays, formatSchedule, stampDate } from "@/lib/event-format"
import { initialsOf } from "@/lib/shell-user"

import { joinedMonth, PastRow } from "./organizer-page"
import { SocialLinks } from "./social-links"

// /vendors/[slug] (spec §7.2, mockup VendorP4). No contact form, and never
// the phone, email, applications, documents, or payments.
export function VendorPageView({ page, supportEmail }: { page: PublicVendorPage; supportEmail: string }) {
  const v = page.vendor
  const next = page.next
  const nextDays = next ? eventDays(next.event) : 0
  return (
    <article className="flex flex-col gap-10 md:gap-14">
      <section className="flex flex-col gap-8 md:flex-row md:flex-wrap md:items-start md:gap-x-14 md:gap-y-8">
        {/* One heading: beside the avatar on phones, under it on the right on desktop. */}
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3.5 md:flex-[999_1_560px] md:items-start md:gap-x-7">
          {v.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized
            <img src={v.avatarUrl} alt="" className="size-22 rounded-pill object-cover md:row-span-6 md:size-28" />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-22 place-items-center rounded-pill bg-sunken text-[28px] font-semibold md:row-span-6 md:size-28 md:text-[36px]"
            >
              {initialsOf(v.shopName)}
            </span>
          )}
          <h1 className="text-display text-balance">{v.shopName}</h1>
          <div className="col-span-2 flex min-w-0 flex-col gap-3.5 md:col-span-1 md:col-start-2">
            {v.categories.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {v.categories.map((c) => (
                  <li key={c} className="inline-flex h-7 items-center rounded-sm bg-sunken px-2.5 text-[13px] font-medium">
                    {c}
                  </li>
                ))}
              </ul>
            )}
            {v.description && <p className="max-w-[620px] whitespace-pre-line text-pretty md:text-body-lg">{v.description}</p>}
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm md:grid-cols-[120px_1fr]">
              {v.products && (
                <>
                  <dt className="text-muted">Sells</dt>
                  <dd className="mb-2 md:mb-0">{v.products}</dd>
                </>
              )}
              <dt className="text-muted">On Creavent</dt>
              <dd>
                {[`Since ${joinedMonth(v.joinedAt)}`, v.city, v.eventsSoldAt ? `sold at ${v.eventsSoldAt} ${v.eventsSoldAt === 1 ? "event" : "events"}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </dd>
            </dl>
            <SocialLinks links={v.socialLinks} />
          </div>
        </div>

        {next && (
          <section
            aria-labelledby="next-h"
            className="flex flex-col gap-4 rounded-lg border-2 border-ink bg-surface p-4 md:max-w-[400px] md:flex-[1_1_320px] md:border md:border-border md:p-6 md:shadow-md"
          >
            <h2 id="next-h" className="text-label text-muted">
              Find them next at
            </h2>
            <div className="flex items-start gap-4">
              {next.event.startDate && (
                <DateStamp
                  date={stampDate(next.event.startDate)}
                  endDay={nextDays > 1 && next.event.endDate ? Number(next.event.endDate.slice(8)) : undefined}
                  size="lg"
                />
              )}
              <div className="flex flex-col gap-0.5">
                <p className="text-h3">{next.event.name}</p>
                <p className="text-sm text-muted">{formatSchedule(next.event)}</p>
                <p className="text-sm text-muted">{next.event.venueName}</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md bg-sunken px-4 py-3">
              <span className="text-sm text-muted">{next.slotLabel.includes(", ") ? "Slots" : "Slot"}</span>
              <span className="font-mono text-[20px] leading-6 font-semibold">{next.slotLabel}</span>
            </div>
            <Button asChild block>
              <Link href={`/events/${next.event.slug}`}>See event and floor plan</Link>
            </Button>
          </section>
        )}
      </section>

      {v.photos.length > 0 && (
        <section aria-labelledby="photos-h" className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3">
            <h2 id="photos-h" className="text-h3 md:text-h2">
              From the stall
            </h2>
            <span className="text-sm text-muted">{`${v.photos.length} ${v.photos.length === 1 ? "photo" : "photos"}`}</span>
          </div>
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            {v.photos.map((src, i) => (
              <li key={src}>
                {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
                <img
                  src={src}
                  alt={`${v.shopName}, photo ${i + 1}`}
                  className="aspect-square w-full rounded-[10px] object-cover md:rounded-lg"
                  loading="lazy"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {page.sold.length > 0 && (
        <section aria-labelledby="sold-h" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="sold-h" className="text-h3 md:text-h2">
              Where they&apos;ve sold
            </h2>
            <p className="text-sm text-muted">{`Events where ${v.shopName} had a confirmed slot`}</p>
          </div>
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {page.sold.map((s) => (
              <PastRow
                key={s.slug}
                e={s}
                detail={[s.organizerName, s.venueName].filter(Boolean).join(" · ")}
                upcoming={s.upcoming}
                trailing={<span className="font-mono text-mono text-muted">{s.slotLabel}</span>}
              />
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-muted">
        Something wrong with this vendor? Email{" "}
        <a href={`mailto:${supportEmail}`} className="text-ink underline underline-offset-2">
          {supportEmail}
        </a>{" "}
        and we&apos;ll look into it.
      </p>
    </article>
  )
}
