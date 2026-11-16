import { revalidateTag } from "next/cache"
import { timingSafeEqual } from "node:crypto"
import { z } from "zod"

const bodySchema = z.object({ tags: z.array(z.string().min(1).max(256)).min(1).max(200) })

function secretMatches(given: string | null) {
  const expected = process.env.REVALIDATE_SECRET ?? ""
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// The API calls this after a change that shows on public pages, with the
// tags of those pages and the shared secret (decision Q1). The pages are
// expired at once, so the next visitor gets the new version.
export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-revalidate-secret"))) return new Response(null, { status: 401 })
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return new Response(null, { status: 400 })
  for (const tag of parsed.data.tags) revalidateTag(tag, { expire: 0 })
  return new Response(null, { status: 204 })
}
