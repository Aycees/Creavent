"use client"

import type { PublicVendorRow } from "@creavent/shared"
import Link from "next/link"
import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { initialsOf } from "@/lib/shell-user"

const FIRST = 9

// The accepted-vendor list (spec §7): filter by category, the first 9 then
// "Show all". A vendor whose page isn't available shows without a link.
export function VendorList({ vendors, title }: { vendors: PublicVendorRow[]; title: string }) {
  const id = React.useId()
  const [category, setCategory] = React.useState<string | null>(null)
  const [all, setAll] = React.useState(false)
  const categories = [...new Set(vendors.flatMap((v) => v.categories))]
  const shown = category ? vendors.filter((v) => v.categories.includes(category)) : vendors
  const visible = all ? shown : shown.slice(0, FIRST)

  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-h2">
          {title}
        </h2>
        <p className="text-sm text-muted">
          {vendors.length === 0
            ? "The vendor list is coming soon."
            : `${vendors.length} ${vendors.length === 1 ? "vendor" : "vendors"} with a confirmed slot. Slot numbers match the floor plan.`}
        </p>
      </div>
      {categories.length > 1 && (
        <div
          role="group"
          aria-label="Filter by category"
          className="-mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden"
        >
          <Chip pressed={category === null} count={vendors.length} onClick={() => setCategory(null)}>
            All
          </Chip>
          {categories.map((c) => (
            <Chip key={c} pressed={category === c} count={vendors.filter((v) => v.categories.includes(c)).length} onClick={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
        </div>
      )}
      {visible.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface md:grid md:grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] md:gap-2.5 md:overflow-visible md:border-0 md:bg-transparent">
          {visible.map((v) => {
            const body = (
              <>
                <Avatar>
                  {v.avatarUrl && <AvatarImage src={v.avatarUrl} alt="" />}
                  <AvatarFallback>{v.slug === null && v.shopName === "Deleted user" ? "?" : initialsOf(v.shopName)}</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={v.slug ? "truncate text-label font-semibold underline underline-offset-3" : "truncate text-label font-semibold"}>
                    {v.shopName}
                  </span>
                  <span className="truncate text-cap text-muted">{v.categories.join(", ")}</span>
                </span>
                <span className="font-mono text-mono">{v.slotLabel}</span>
              </>
            )
            const row = "flex min-h-16 items-center gap-3 px-3.5 py-3"
            return (
              <li key={v.slotLabel} className="border-b border-border last:border-b-0 md:rounded-lg md:border md:bg-surface md:last:border-b">
                {v.slug ? (
                  <Link href={`/vendors/${v.slug}`} className={`${row} text-ink no-underline`}>
                    {body}
                  </Link>
                ) : (
                  <div className={row}>{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {!all && shown.length > FIRST && (
        <Button type="button" variant="secondary" className="self-stretch md:self-start" onClick={() => setAll(true)}>
          {`Show all ${shown.length} vendors`}
        </Button>
      )}
    </section>
  )
}
