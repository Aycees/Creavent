import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr"

import { safeLink } from "@/lib/safe-link"

// Social links on profile pages (spec §7.1, §7.2). Only http and https links
// show, with their real host, opening in a new tab.
export function SocialLinks({ links, className }: { links: string[]; className?: string }) {
  const safe = links.flatMap((l) => safeLink(l) ?? [])
  if (!safe.length) return null
  return (
    <ul className={className ?? "flex flex-wrap gap-2"}>
      {safe.map((l) => (
        <li key={l.href}>
          <a
            href={l.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border-strong bg-surface px-3.5 text-label text-ink no-underline"
          >
            <span className="break-all">{`${l.host.replace(/^www\./, "")}${l.rest ?? ""}`}</span>
            <ArrowSquareOutIcon aria-hidden="true" className="size-4 flex-none" />
          </a>
        </li>
      ))}
    </ul>
  )
}
