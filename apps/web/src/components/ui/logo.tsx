import Link from "next/link"

import { cn } from "@/lib/utils"

// "Market grid" logo (design brief §9): a 3 x 3 grid in ink, the center square
// in ember, the last square outlined, next to the lowercase wordmark. Sized in
// em, so it scales with font size: 22px in headers, 20px on phones.
function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-[0.36em] text-[20px] leading-7 font-semibold tracking-[-0.035em] text-ink no-underline md:text-[22px]",
        className
      )}
    >
      <span aria-hidden="true" className="grid flex-none grid-cols-[repeat(3,0.27em)] gap-[0.09em]">
        {Array.from({ length: 9 }, (_, i) => (
          <i
            key={i}
            className={cn(
              "block h-[0.27em] rounded-[0.06em] bg-current",
              i === 4 && "bg-brand",
              i === 8 && "bg-transparent shadow-[inset_0_0_0_0.07em_currentColor]"
            )}
          />
        ))}
      </span>
      creavent
    </Link>
  )
}

export { Logo }
