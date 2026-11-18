"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"


const PIXELS_PER_SECOND = 28

// Later (mockup ListingP4): cards drift sideways and stop whenever someone
// hovers, touches, or focuses one, and can be scrolled by hand. When there are
// more cards than fit, a second copy of the row follows the first so the drift
// loops without a jump; when they all fit, the row stays still. People who
// prefer reduced motion get no automatic movement.
export function LaterCarousel({ title, meta, calendarHref, children }: { title: string; meta: string; calendarHref: string; children: React.ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null)
  const firstSet = useRef<HTMLUListElement>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [engaged, setEngaged] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setReducedMotion(true)
  }, [])

  useEffect(() => {
    const el = scroller.current
    const set = firstSet.current
    if (!el || !set) return
    const measure = () => setOverflowing(set.scrollWidth > el.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    observer.observe(set)
    return () => observer.disconnect()
  }, [])

  // Distance from the start of the first copy to the start of the second.
  const loopWidth = () => {
    const second = firstSet.current?.nextElementSibling as HTMLElement | null
    return second && firstSet.current ? second.offsetLeft - firstSet.current.offsetLeft : 0
  }

  const wrap = () => {
    const el = scroller.current
    const width = loopWidth()
    if (el && width > 0 && el.scrollLeft >= width) el.scrollLeft -= width
  }

  useEffect(() => {
    const el = scroller.current
    if (!el || !overflowing || reducedMotion || engaged) return
    let position = el.scrollLeft
    let last: number | undefined
    let frame = requestAnimationFrame(function tick(now) {
      if (last !== undefined) position += ((now - last) / 1000) * PIXELS_PER_SECOND
      last = now
      const width = loopWidth()
      if (width > 0 && position >= width) position -= width
      el.scrollLeft = position
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [overflowing, reducedMotion, engaged])

  const row = "flex flex-none gap-4 md:gap-6"

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
      <div
        ref={scroller}
        onPointerEnter={() => setEngaged(true)}
        onPointerLeave={() => setEngaged(false)}
        onFocus={() => setEngaged(true)}
        onBlur={() => setEngaged(false)}
        onScroll={overflowing ? wrap : undefined}
        className="relative -mx-4 flex gap-4 overflow-x-auto px-4 py-1 [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] md:-mx-1 md:gap-6 md:px-1"
      >
        <ul ref={firstSet} className={row}>
          {children}
        </ul>
        {overflowing && (
          <ul aria-hidden inert className={row}>
            {children}
          </ul>
        )}
      </div>
    </section>
  )
}
