import { listingQuerySchema, listingWhenSchema } from "@creavent/shared"
import type { Metadata } from "next"
import { Suspense } from "react"

import { listingHref, ListingView, type ListingParams } from "@/components/listing/listing-view"
import { getListing } from "@/lib/public-api"
import { monthDays } from "@/lib/listing"

export const metadata: Metadata = {
  title: "Creavent · Markets, bazaars and pop-ups in Davao",
  description: "Find flea markets, bazaars and pop-ups in Davao, and who's selling. Vendor and exhibitor management for organizers.",
  openGraph: { title: "Markets, bazaars and pop-ups in Davao", siteName: "Creavent", type: "website" },
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const monthPattern = /^\d{4}-\d{2}$/
const dayPattern = /^\d{4}-\d{2}-\d{2}$/

// Only the filters that make sense: anything else in the address is ignored.
function readParams(raw: Record<string, string | string[] | undefined>): ListingParams {
  const parsed = listingQuerySchema.safeParse({
    q: one(raw.q) || undefined,
    type: one(raw.type) || undefined,
    city: one(raw.city) || undefined,
    when: listingWhenSchema.safeParse(one(raw.when)).data,
    from: one(raw.from) || undefined,
    to: one(raw.to) || undefined,
  })
  const month = one(raw.month)
  const day = one(raw.day)
  return {
    ...(parsed.success ? parsed.data : {}),
    view: one(raw.view) === "calendar" ? "calendar" : undefined,
    month: month && monthPattern.test(month) ? month : undefined,
    day: day && dayPattern.test(day) ? day : undefined,
  }
}

async function View({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = readParams(await searchParams)
  // The calendar shows a whole month, so it asks for that month's events.
  const apiParams: ListingParams = { q: params.q, type: params.type, city: params.city, when: params.when, from: params.from, to: params.to }
  if (params.view === "calendar") {
    const month = params.month ?? params.day?.slice(0, 7)
    if (month) {
      const days = monthDays(month).filter((d) => d.inMonth)
      Object.assign(apiParams, { when: "dates", from: days[0]!.date, to: days.at(-1)!.date })
    } else {
      Object.assign(apiParams, { when: undefined, from: undefined, to: undefined })
    }
  }
  const listing = await getListing(listingHref(apiParams).slice(2))
  return <ListingView listing={listing} query={params.view === "calendar" && !params.month ? { ...params, month: params.day?.slice(0, 7) } : params} />
}

// / (spec §7.3, flow 10).
export default function EventsPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense>
      <View searchParams={searchParams} />
    </Suspense>
  )
}
