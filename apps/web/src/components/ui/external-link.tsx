import { ArrowSquareOutIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr"

import { Badge } from "@/components/ui/badge"
import { safeLink } from "@/lib/safe-link"

// A user-submitted link: the real host in full (punycode shows lookalike
// letters), a Known site or External site tag, and the rest of the link
// below. It opens in a new tab with no referrer or opener.
export function ExternalLink({ link, showKnown = true }: { link: string; showKnown?: boolean }) {
  const safe = safeLink(link)
  if (!safe) {
    return (
      <span className="flex min-h-11 items-center gap-2 rounded-md border border-danger px-3 text-sm text-danger-ink">
        <WarningIcon aria-hidden="true" className="size-4 flex-none" />
        <span>Not a valid link</span>
      </span>
    )
  }
  return (
    <a
      href={safe.href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 py-2 text-sm text-ink no-underline hover:border-border-strong"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold break-all">{safe.host}</span>
          {showKnown && (
            <Badge tone={safe.known ? "neutral" : "warning"} dot={false}>
              {safe.known ? "Known site" : "External site"}
            </Badge>
          )}
        </span>
        {safe.rest && <span className="text-cap break-all text-muted">{safe.rest}</span>}
      </span>
      <ArrowSquareOutIcon aria-hidden="true" className="size-4 flex-none" />
    </a>
  )
}
