// The page to return to after signing in, from ?next=. Only a path on this
// site: anything that could point elsewhere is refused, so a crafted link
// can't send people to another site after they log in.
export function safeNext(value: string | null): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return undefined
  // Backslashes, whitespace, and control characters let browsers read a path
  // as another host.
  if (/[\\\u0000- \u007f]/.test(value)) return undefined
  const base = "https://creavent.invalid"
  const url = new URL(value, base)
  if (url.origin !== base) return undefined
  return url.pathname + url.search + url.hash
}
