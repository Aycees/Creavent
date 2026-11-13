"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

type NavLinkProps = Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: string
  /** Only match this exact path, for area roots like /vendor. Otherwise detail pages match too. */
  exact?: boolean
}

export function isActivePath(pathname: string, href: string, exact = false) {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`))
}

function ActiveLink({ href, exact, ...props }: NavLinkProps) {
  const active = isActivePath(usePathname(), href, exact)
  return <Link href={href} aria-current={active ? "page" : undefined} data-active={active || undefined} {...props} />
}

// With cacheComponents, usePathname suspends on pages with an unknown dynamic param
// (for example /events/[slug]). The fallback is the same link without the active mark,
// so the rest of the layout still prerenders.
export function NavLink({ exact, ...props }: NavLinkProps) {
  return (
    <React.Suspense fallback={<Link {...props} />}>
      <ActiveLink exact={exact} {...props} />
    </React.Suspense>
  )
}
