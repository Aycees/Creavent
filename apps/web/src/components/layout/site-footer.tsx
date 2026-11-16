import Link from "next/link"

import { Logo } from "@/components/ui/logo"

const links = [
  { label: "Approved by Creavent", href: "/approved" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Support", href: "/support" },
]

// `.footer`: on every page (sitemap §5).
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-page flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted md:px-8">
        <Logo className="text-[18px] md:text-[18px]" />
        <span>Vendor and exhibitor management, and event discovery. Davao City, Philippines.</span>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 md:ml-auto">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center text-muted no-underline hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
