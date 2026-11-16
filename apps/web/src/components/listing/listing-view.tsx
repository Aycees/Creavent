import type { Listing, ListingCard, ListingWhen } from "@creavent/shared"
import { CaretLeftIcon, CaretRightIcon, CheckIcon, MagnifyingGlassIcon, MapPinIcon, SquaresFourIcon, StorefrontIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"

import { ApprovedMark } from "@/components/ui/approved-mark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/ui/container"
import { DateStamp } from "@/components/ui/date-stamp"
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder"
import { eventDays, formatDay, formatTime, stampDate } from "@/lib/event-format"
import { groupByWeekend, monthDays, monthLabel, nextMonthName, runsOn, shiftMonth } from "@/lib/listing"
import { cn } from "@/lib/utils"

import { SellLink } from "./sell-link"

export type ListingParams = {
  q?: string
  type?: string
  city?: string
  when?: ListingWhen
  from?: string
  to?: string
  view?: "calendar"
  month?: string
  day?: string
}

const order: (keyof ListingParams)[] = ["q", "type", "city", "when", "from", "to", "view", "month", "day"]

// A link to / with these filters, in a stable order so links are shareable.
export function listingHref(params: ListingParams) {
  const search = new URLSearchParams()
  for (const key of order) {
    const value = params[key]
    if (value) search.set(key, value)
  }
  const s = search.toString()
  return s ? `/?${s}` : "/"
}

const without = (p: ListingParams, ...keys: (keyof ListingParams)[]) => {
  const copy = { ...p }
  for (const k of keys) delete copy[k]
  return copy
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`

// "Fri, Nov 20 to Sun, Nov 22 · 9 AM to 5 PM daily" on cards, "Sat · 5 PM" on rows.
function cardWhen(e: ListingCard) {
  if (!e.startDate || !e.endDate || !e.opensAt || !e.closesAt) return "Dates to be announced"
  const hours = `${formatTime(e.opensAt)} to ${formatTime(e.closesAt)}`
  return e.startDate === e.endDate ? `${formatDay(e.startDate)} · ${hours}` : `${formatDay(e.startDate)} to ${formatDay(e.endDate)} · ${hours} daily`
}

function Stamp({ e, className }: { e: ListingCard; className?: string }) {
  if (!e.startDate) return null
  const days = eventDays(e)
  return <DateStamp date={stampDate(e.startDate)} endDay={days > 1 && e.endDate ? Number(e.endDate.slice(8)) : undefined} className={className} />
}

function Tags({ e }: { e: ListingCard }) {
  const days = eventDays(e)
  return (
    <span className="flex flex-wrap gap-1.5">
      <Badge dot={false}>{e.typeName}</Badge>
      {days > 1 && (
        <Badge tone="info" dot={false}>
          {`${days} days`}
        </Badge>
      )}
    </span>
  )
}

// A big card for this and next weekend (mockup ListingP4): the date stamp
// sits on the cover's edge.
export function EventCard({ e }: { e: ListingCard }) {
  return (
    <li>
      <Link
        href={`/events/${e.slug}`}
        className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface text-ink no-underline shadow-sm transition-shadow hover:shadow-md"
      >
        {e.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized
          <img src={e.coverUrl} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <PhotoPlaceholder />
        )}
        <span className="relative flex flex-1 flex-col gap-1.5 px-4 pt-10 pb-4 md:px-5 md:pb-5">
          <Stamp e={e} className="absolute -top-7.5 left-4 shadow-sm md:left-5" />
          <Tags e={e} />
          <span className="text-h3 md:text-[20px] md:leading-[26px]">{e.name}</span>
          <span className="text-sm text-muted">{cardWhen(e)}</span>
          <span className="text-sm text-muted">{[e.venueName, e.city].filter(Boolean).join(", ")}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            {e.organizer.displayName}
            {e.organizer.approved && <ApprovedMark compact link={false} />}
          </span>
        </span>
      </Link>
    </li>
  )
}

// A compact row for Later and the calendar's day list.
export function EventRow({ e, note }: { e: ListingCard; note?: string }) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link href={`/events/${e.slug}`} className="flex min-h-19 items-center gap-4 px-4 py-3.5 text-ink no-underline md:px-5">
        <Stamp e={e} className="h-12 w-11 [&_[data-day]]:text-[19px] [&_[data-sub]]:hidden" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[16px] leading-[22px] font-semibold">{e.name}</span>
          <span className="text-sm text-muted">{[e.typeName, note ?? cardWhen(e), e.venueName].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="hidden items-center gap-2 text-sm text-muted md:flex">
          {e.organizer.displayName}
          {e.organizer.approved && <ApprovedMark sealOnly link={false} />}
        </span>
        <CaretRightIcon aria-hidden="true" className="size-5 flex-none text-muted" />
      </Link>
    </li>
  )
}

const typeLabel = (name: string) => `${name}s`

function whenPhrase(p: ListingParams, today: string) {
  switch (p.when) {
    case "weekend":
      return "this weekend"
    case "2weeks":
      return "in the next 2 weeks"
    case "next_month":
      return `in ${nextMonthName(today)}`
    case "dates":
      return "on those dates"
    default:
      return ""
  }
}

function Empty({ params, today }: { params: ListingParams; today: string }) {
  const when = whenPhrase(params, today)
  const title = params.q ? `No events match "${params.q}"${when ? ` ${when}` : ""}` : `No events ${when || "match these filters"}`
  return (
    <div className="flex flex-col items-start gap-2 py-8">
      <MagnifyingGlassIcon aria-hidden="true" className="size-8 text-muted" />
      <h2 className="mt-2 text-h3">{title}</h2>
      <p className="text-muted">Try fewer words, or widen the dates.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {params.when && (
          <Button asChild>
            <Link href={listingHref(without(params, "when", "from", "to"))}>Show any date</Link>
          </Button>
        )}
        <Button asChild variant="secondary">
          <Link href="/">Clear all</Link>
        </Button>
      </div>
    </div>
  )
}

function FilterLink({ href, current, count, children }: { href: string; current: boolean; count?: number; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-pill border px-4 text-label whitespace-nowrap no-underline md:h-10",
        current ? "border-inverse bg-inverse text-on-inverse" : "border-border-strong bg-surface text-ink",
      )}
    >
      {children}
      {count !== undefined && " "}
      {count !== undefined && <span className={cn("tabular-nums", current ? "text-on-inverse-muted" : "text-muted")}>{count}</span>}
    </Link>
  )
}

// A chip row that scrolls sideways on phones. The 4px of padding keeps focus rings
// from being clipped by the scroll box.
const scrollRow = "-my-1 flex items-center gap-2 overflow-x-auto py-1 pr-1 [scrollbar-width:none] md:-mx-1 md:px-1"
// List or Calendar: 44px tall on phones, 40px (with the pill's inset) to match the chips on wider screens.
const viewItem = "inline-flex h-11 items-center rounded-pill px-3.5 text-label text-muted no-underline md:h-9 md:px-4"
const viewOn = "bg-surface text-ink shadow-sm"

const stripDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
})

function Next7({ listing }: { listing: Listing }) {
  return (
    <nav aria-label="Next 7 days" className="grid grid-cols-7 gap-1 md:gap-1.5">
      {listing.next7.map((d) => {
        const isToday = d.date === listing.today
        const label = `${isToday ? "Today, " : ""}${formatDay(d.date)}, ${d.count ? plural(d.count, "event") : "no events"}`
        return (
          <Link
            key={d.date}
            href={listingHref({
              view: "calendar",
              month: d.date.slice(0, 7),
              day: d.date,
            })}
            aria-label={label}
            className={cn(
              "flex min-h-17 flex-col items-center justify-center gap-0.5 rounded-[10px] bg-surface text-ink no-underline tabular-nums md:min-h-19",
              isToday ? "border-2 border-brand" : "border border-border",
            )}
          >
            <span className={cn("text-cap", isToday ? "font-semibold text-brand-ink" : "text-muted")}>
              {isToday ? "Today" : stripDay.format(new Date(`${d.date}T00:00:00Z`))}
            </span>
            <span className="text-[20px] leading-6 font-[650] tracking-[-0.02em]">{Number(d.date.slice(8))}</span>
            <span aria-hidden="true" className={cn("size-1.5 rounded-pill", d.count ? "bg-ink" : "bg-transparent")} />
          </Link>
        )
      })}
    </nav>
  )
}

function Calendar({ listing, params }: { listing: Listing; params: ListingParams }) {
  const month = params.month ?? listing.today.slice(0, 7)
  const days = monthDays(month)
  const label = monthLabel(month)
  const firstEventDay = listing.events.find((e) => e.startDate?.startsWith(month))?.startDate
  const selected = params.day ?? (listing.today.startsWith(month) ? listing.today : (firstEventDay ?? `${month}-01`))
  const onDay = listing.events.filter((e) => runsOn(e, selected))
  const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7))
  const base = { ...without(params, "day"), view: "calendar" as const }

  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-8">
      <section aria-labelledby="month-h" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="month-h" className="text-h2">
            {label}
          </h2>
          <div className="flex gap-1">
            <Button asChild variant="ghost" size="icon">
              <Link href={listingHref({ ...base, month: shiftMonth(month, -1) })} aria-label="Previous month">
                <CaretLeftIcon aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon">
              <Link href={listingHref({ ...base, month: shiftMonth(month, 1) })} aria-label="Next month">
                <CaretRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
        <table role="grid" aria-label={label} className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <th key={d} scope="col" className="py-2 text-cap font-medium text-muted md:border md:border-border md:bg-sunken md:px-3 md:text-left">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]!.date}>
                {week.map((d) => {
                  const events = listing.events.filter((e) => runsOn(e, d.date))
                  const past = d.date < listing.today
                  const isSelected = d.date === selected
                  return (
                    <td key={d.date} className={cn("p-0.5 align-top md:h-30 md:border md:border-border md:p-2", d.inMonth ? "md:bg-surface" : "md:bg-canvas")}>
                      <Link
                        href={listingHref({ ...base, month, day: d.date })}
                        aria-current={isSelected ? "date" : undefined}
                        aria-label={`${formatDay(d.date)}, ${events.length ? plural(events.length, "event") : "no events"}`}
                        className={cn(
                          "flex h-11 flex-col items-center justify-center gap-0.5 rounded-[10px] text-[15px] font-medium text-ink no-underline tabular-nums md:h-auto md:items-start md:rounded-md",
                          !d.inMonth || past ? "text-subtle" : "",
                          isSelected && "bg-inverse text-on-inverse md:bg-transparent md:text-ink md:ring-2 md:ring-ink",
                          d.date === listing.today && !isSelected && "font-bold text-brand",
                        )}
                      >
                        <span
                          className={cn(
                            "md:grid md:size-7 md:place-items-center md:rounded-pill",
                            d.date === listing.today && "md:bg-brand md:text-on-inverse",
                          )}
                        >
                          {Number(d.date.slice(8))}
                        </span>
                        {events.length > 0 && (
                          <span aria-hidden="true" className={cn("size-1.5 rounded-pill md:hidden", isSelected ? "bg-on-inverse" : "bg-ink")} />
                        )}
                      </Link>
                      <ul className="mt-1 hidden flex-col gap-1 md:flex">
                        {events.slice(0, 3).map((e) => (
                          <li key={e.slug}>
                            <Link href={`/events/${e.slug}`} className="block truncate rounded-sm bg-sunken px-2 py-1 text-cap text-ink no-underline">
                              {e.name}
                            </Link>
                          </li>
                        ))}
                        {events.length > 3 && <li className="px-2 text-cap text-muted">{`${events.length - 3} more`}</li>}
                      </ul>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section aria-label={formatDay(selected)} className="flex flex-col gap-3 md:sticky md:top-6">
        <h2 className="text-h3">{formatDay(selected)}</h2>
        {onDay.length ? (
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {onDay.map((e) => {
              const days = eventDays(e)
              const n = days > 1 && e.startDate ? Math.round((Date.parse(selected) - Date.parse(e.startDate)) / 86_400_000) + 1 : 0
              return <EventRow key={e.slug} e={e} note={n ? `Day ${n} of ${days}` : undefined} />
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">No announced events this day.</p>
        )}
      </section>
    </div>
  )
}

function SellBand({ count }: { count: number }) {
  const check = (text: string) => (
    <li className="flex items-start gap-2.5 text-sm">
      <CheckIcon aria-hidden="true" className="mt-0.5 size-4 flex-none" />
      {text}
    </li>
  )
  return (
    <section aria-labelledby="sell-h" className="flex flex-col gap-5 pt-2">
      <div className="flex flex-col gap-1.5">
        <h2 id="sell-h" className="text-h2">
          Selling or running an event?
        </h2>
        <p className="max-w-[640px] text-muted">
          Creavent also runs the vendor side: applications, slots, and payment checks, so organizers and vendors can stop juggling chat threads and
          spreadsheets.
        </p>
      </div>
      <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-6">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 md:p-6">
          <h3 className="flex items-center gap-2.5 text-h3">
            <StorefrontIcon aria-hidden="true" className="size-6" />
            For vendors and exhibitors
          </h3>
          <ul className="flex flex-col gap-2">
            {check("Apply to events with your shop profile, documents, and preferred slot")}
            {check("See your slot, amount due, and deadline, then pay the organizer directly")}
            {check("Get a public shop page that shows where to find you next")}
          </ul>
          <div className="mt-auto flex flex-col gap-2 pt-2 md:flex-row md:items-center md:gap-4">
            <SellLink />
            <p className="text-sm text-muted max-md:text-center">
              <span className="font-semibold text-ink tabular-nums">{count}</span> <span>events are open to vendors now</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 md:p-6">
          <h3 className="flex items-center gap-2.5 text-h3">
            <SquaresFourIcon aria-hidden="true" className="size-6" />
            For organizers
          </h3>
          <ul className="flex flex-col gap-2">
            {check("Take vendor applications with the categories and permits you need")}
            {check("Assign slots from your floor plan and check proofs of payment")}
            {check("Announce when your vendor list is final, and attendees find you here")}
          </ul>
          <div className="mt-auto pt-2">
            <Button asChild variant="secondary" className="max-md:w-full">
              <Link href="/signup?as=organizer">Run an event on Creavent</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

// / (spec §7.3, flow 10, mockup ListingP4). Rendered on the server from the
// cached listing; every filter is a plain link, so it works before any
// script loads on a slow phone.
export function ListingView({ listing, query: params }: { listing: Listing; query: ListingParams }) {
  const calendar = params.view === "calendar"
  const listParams = without(params, "view", "month", "day")
  const total = listing.types.reduce((sum, t) => sum + t.count, 0)
  const groups = groupByWeekend(listing.events, listing.today)

  return (
    <div className="flex flex-col">
      <Container>
        <section className="flex flex-col gap-6 pt-6 pb-5 md:flex-row md:flex-wrap md:items-end md:gap-x-16 md:gap-y-8 md:pt-14 md:pb-8">
          <div className="flex min-w-0 flex-col gap-3 md:flex-[999_1_520px] md:gap-4">
            <h1 className="max-w-[680px] text-display text-balance">Markets, bazaars and pop-ups in Davao</h1>
            <p className="max-w-[560px] text-muted md:text-body-lg">See what&apos;s on and who&apos;s selling. Every organizer here is approved by Creavent.</p>
            <form
              role="search"
              action="/"
              className="mt-1 flex h-12 max-w-[600px] items-center gap-2.5 rounded-pill border border-border-strong bg-surface pr-1.5 pl-4.5 text-muted shadow-sm md:mt-2 md:h-13"
            >
              <MagnifyingGlassIcon aria-hidden="true" className="size-5 flex-none" />
              <label htmlFor="listing-q" className="sr-only">
                Search events
              </label>
              <input
                id="listing-q"
                type="search"
                name="q"
                defaultValue={params.q}
                placeholder="Events, venues, organizers"
                className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
              />
              {(["type", "city", "when", "from", "to"] as const).map((k) => (params[k] ? <input key={k} type="hidden" name={k} value={params[k]} /> : null))}
              <Button type="submit" className="h-10 rounded-pill max-md:hidden">
                Search
              </Button>
            </form>
          </div>
          <div className="flex flex-col gap-2.5 md:flex-[1_1_420px]">
            <div className="flex items-center justify-between">
              <h2 className="text-label">Next 7 days</h2>
              <Link href={listingHref({ ...listParams, view: "calendar" })} className="inline-flex min-h-11 items-center text-sm">
                Open calendar
              </Link>
            </div>
            <Next7 listing={listing} />
          </div>
        </section>
      </Container>

      {/* One toolbar, each control rendered once. Phones: type chips on the first row, then
          dates and city scrolling beside the List or Calendar switch. Wider screens: type chips
          and the switch share the first row, dates and city sit on the second. */}
      <div className="border-y border-border bg-surface">
        <Container className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-2.5 md:gap-x-6 md:gap-y-3 md:py-3">
          <nav aria-label="Event type" className={cn(scrollRow, "col-span-2 -mx-4 px-4 md:col-span-1 md:row-start-1")}>
            <FilterLink href={listingHref(without(params, "type"))} current={!params.type} count={total}>
              All
            </FilterLink>
            {listing.types.map((t) => (
              <FilterLink key={t.slug} href={listingHref({ ...params, type: t.slug })} current={params.type === t.slug} count={t.count}>
                {typeLabel(t.name)}
              </FilterLink>
            ))}
          </nav>
          {/* On phones the row fades out before the switch, so it reads as one that scrolls. */}
          <div
            className={cn(
              scrollRow,
              "col-start-1 row-start-2 -ml-4 pl-4 max-md:[mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] md:col-span-2",
            )}
          >
            <nav aria-label="Date" className="flex flex-none gap-2">
              {(
                [
                  ["any", "Any date"],
                  ["weekend", "This weekend"],
                  ["2weeks", "Next 2 weeks"],
                  ["next_month", nextMonthName(listing.today)],
                ] as const
              ).map(([when, label]) => (
                <FilterLink
                  key={when}
                  href={listingHref({
                    ...without(params, "when", "from", "to"),
                    when: when === "any" ? undefined : when,
                  })}
                  current={(params.when ?? "any") === when}
                >
                  {label}
                </FilterLink>
              ))}
            </nav>
            {listing.cities.length > 0 && (
              <>
                <span aria-hidden="true" className="h-7 w-px flex-none bg-border" />
                <nav aria-label="City" className="flex flex-none gap-2">
                  {listing.cities.map((c) => (
                    <FilterLink key={c} href={listingHref(params.city === c ? without(params, "city") : { ...params, city: c })} current={params.city === c}>
                      <MapPinIcon aria-hidden="true" className="size-4" />
                      {c}
                    </FilterLink>
                  ))}
                </nav>
              </>
            )}
          </div>
          <nav aria-label="View" className="col-start-2 row-start-2 inline-flex gap-0.5 justify-self-end rounded-pill bg-sunken md:row-start-1 md:p-0.5">
            <Link href={listingHref(listParams)} aria-current={!calendar ? "page" : undefined} className={cn(viewItem, !calendar && viewOn)}>
              List
            </Link>
            <Link
              href={listingHref({
                ...listParams,
                view: "calendar",
                month: params.month,
              })}
              aria-current={calendar ? "page" : undefined}
              className={cn(viewItem, calendar && viewOn)}
            >
              Calendar
            </Link>
          </nav>
        </Container>
      </div>

      <Container className="flex flex-col gap-12 pt-8 pb-12 md:gap-14 md:pt-10 md:pb-18">
        {calendar ? (
          <Calendar listing={listing} params={params} />
        ) : listing.events.length === 0 ? (
          <Empty params={params} today={listing.today} />
        ) : (
          groups.map((g) => (
            <section key={g.key} aria-labelledby={`g-${g.key}`} className="flex flex-col gap-4 md:gap-5">
              <div className="flex items-baseline gap-3">
                <h2 id={`g-${g.key}`} className="text-h3 md:text-h2">
                  {g.title}
                </h2>
                {g.from && g.to && <span className="text-sm text-muted">{`${formatDay(g.from)} and ${formatDay(g.to)}`}</span>}
              </div>
              {g.key === "later" ? (
                <ul className="overflow-hidden rounded-lg border border-border bg-surface">
                  {g.events.map((e) => (
                    <EventRow key={e.slug} e={e} />
                  ))}
                </ul>
              ) : (
                // Fewer than three cards share the row in halves rather than leaving an empty column.
                <ul
                  className={cn(
                    "grid grid-cols-1 gap-4 md:gap-6",
                    g.events.length < 3 ? "md:grid-cols-2" : "md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]",
                  )}
                >
                  {g.events.map((e) => (
                    <EventCard key={e.slug} e={e} />
                  ))}
                </ul>
              )}
            </section>
          ))
        )}
        <SellBand count={listing.openToVendors} />
      </Container>
    </div>
  )
}
