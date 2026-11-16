import type { Listing, PublicConfig, PublicEventResponse } from "@creavent/shared"
import { cacheLife, cacheTag } from "next/cache"

// Server-side reads of the public pages (architecture §8). Each response is
// cached under the tags the API lists, until the API asks for those tags to
// be refreshed (decision Q1). The browser never calls these.
const apiUrl = () => process.env.API_URL ?? "http://localhost:3001"

async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(`${apiUrl()}${path}`, { cache: "no-store" })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`)
  return (await res.json()) as T
}

// A missing page is kept a minute only: it has no tags yet, and may soon be
// announced or created.
function cacheMissing() {
  cacheLife({ stale: 60, revalidate: 60, expire: 60 })
}

export async function getPublicEvent(slug: string) {
  "use cache"
  const data = await getJson<PublicEventResponse>(`/api/public/events/${encodeURIComponent(slug)}`)
  if (!data) {
    cacheMissing()
    return null
  }
  cacheLife("max")
  cacheTag(...data.tags)
  return data
}

// The event listing for one set of filters. Also refreshed every 15 minutes,
// so "today", the weekend groups, and ended events roll over by themselves.
export async function getListing(search: string) {
  "use cache"
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 })
  const data = await getJson<Listing>(`/api/public/events${search ? `?${search}` : ""}`)
  if (!data) throw new Error("GET /api/public/events failed")
  cacheTag(...data.tags)
  return data
}

export async function getPublicConfig() {
  "use cache"
  cacheLife("hours")
  const data = await getJson<PublicConfig>("/api/public-config")
  if (!data) throw new Error("GET /api/public-config failed")
  return data
}
