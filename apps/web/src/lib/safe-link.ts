import { describeLink } from "@creavent/shared"

// A stored link, checked again before it becomes an href: only http and
// https, with its real host for display. Null for anything else, including
// links saved before the stricter checks.
export function safeLink(link: string) {
  try {
    const url = new URL(link)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return { href: url.href, ...describeLink(url.href) }
  } catch {
    return null
  }
}
