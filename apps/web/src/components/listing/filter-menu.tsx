"use client"

import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react"
import Link from "next/link"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export type FilterMenuItem = { label: string; href: string; current: boolean }

// A filter pill that opens a short list of choices (city, date). Each choice is a
// plain link, so the page stays shareable and the server does the filtering.
export function FilterMenu({ label, icon, items }: { label: string; icon?: React.ReactNode; items: FilterMenuItem[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-pill border border-border-strong bg-surface pr-3 pl-4 text-label whitespace-nowrap text-ink md:h-10">
        {icon}
        {label}
        <CaretDownIcon aria-hidden="true" className="size-4 text-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-48">
        {items.map((item) => (
          <DropdownMenuItem key={item.label} asChild>
            <Link href={item.href} aria-current={item.current ? "true" : undefined} className="justify-between no-underline">
              {item.label}
              {item.current && <CheckIcon aria-hidden="true" />}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
