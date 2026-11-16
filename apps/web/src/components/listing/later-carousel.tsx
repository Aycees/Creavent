"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"


const PIXELS_PER_SECOND = 28

// Later (mockup ListingP4): cards drift sideways and stop whenever someone
// hovers, touches, or focuses one. People who prefer reduced motion get no
// movement at all.
export function LaterCarousel({ title, meta, calendarHref, children }: { title: string; meta: string; calendarHref: string; children: React.ReactNode }) {
  const scroller = useRef<HTMLUListElement>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [engaged, setEngaged] = useState(false)

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setReducedMotion(true)
  }, [])

  useEffect(() => {
    const el = scroller.current
    if (!el || reducedMotion || engaged) return
    let position = el.scrollLeft
    let last: number | undefined
    let frame = requestAnimationFrame(function tick(now) {
      if (last !== undefined) position += ((now - last) / 1000) * PIXELS_PER_SECOND
      last = now
      if (position >= el.scrollWidth - el.clientWidth) position = 0
      el.scrollLeft = position
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [reducedMotion, engaged])

  return (
    <section aria-labelledby="g-later" className="flex flex-col gap-4 md:gap-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
          <h2 id="g-later" className="text-h3 md:text-h2">
            {title}
          </h2>
          <span className="text-sm text-muted max-md:hidden">{meta}</span>
        </div>
        <Link href={calendarHref} className="inline-flex min-h-11 items-center text-sm">
          See all in calendar
        </Link>
      </div>
      <ul
        ref={scroller}
        onPointerEnter={() => setEngaged(true)}
        onPointerLeave={() => setEngaged(false)}
        onFocus={() => setEngaged(true)}
        onBlur={() => setEngaged(false)}
        className="-mx-4 flex gap-4 overflow-x-auto px-4 py-1 [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] md:-mx-1 md:gap-6 md:px-1"
      >
        {children}
      </ul>
    </section>
  )
}
