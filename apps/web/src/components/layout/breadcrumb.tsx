"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { CaretRightIcon } from "@phosphor-icons/react"

import { isActivePath } from "./nav-link"

type Crumb = { label: string; href: string; exact?: boolean }

function Trail({ area, current }: { area: string; current?: string }) {
  return (
    <ol className="flex items-center gap-2 text-label">
      <li className="text-muted">{area}</li>
      {current && (
        <li className="flex items-center gap-2">
          <CaretRightIcon aria-hidden="true" className="size-4 text-subtle" />
          <span aria-current="page">{current}</span>
        </li>
      )}
    </ol>
  )
}

function ActiveTrail({ area, items }: { area: string; items: Crumb[] }) {
  const pathname = usePathname()
  const current = items.find((item) => isActivePath(pathname, item.href, item.exact))
  return <Trail area={area} current={current?.label} />
}

// Top bar breadcrumb: the area, then the menu section of the current page.
// The Suspense fallback covers pages with an unknown dynamic param (see NavLink).
export function Breadcrumb({ area, items, className }: { area: string; items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <React.Suspense fallback={<Trail area={area} />}>
        <ActiveTrail area={area} items={items} />
      </React.Suspense>
    </nav>
  )
}
