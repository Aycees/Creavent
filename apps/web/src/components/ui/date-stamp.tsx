import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// The signature date stamp (design brief §3, §10): ember month over a large ink
// day, weekday below. Multi-day events pass `endDay`, and the third line reads "to 20".
const stampVariants = cva(
  "inline-flex flex-none flex-col items-center justify-center rounded-md border border-border-strong bg-surface tabular-nums",
  {
    variants: {
      size: {
        sm: "h-12 w-11 [&_[data-day]]:text-[19px] [&_[data-day]]:leading-[21px] [&_[data-sub]]:hidden",
        md: "h-15 w-14",
        lg: "h-21 w-19 rounded-[10px] [&_[data-day]]:text-[36px] [&_[data-day]]:leading-[38px] [&_[data-month]]:text-[14px] [&_[data-month]]:leading-[18px] [&_[data-sub]]:text-[12px] [&_[data-sub]]:leading-4",
      },
    },
    defaultVariants: { size: "md" },
  }
)

const TIME_ZONE = "Asia/Manila"

function part(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, ...options }).format(date)
}

function DateStamp({
  date,
  endDay,
  size,
  className,
}: {
  date: Date
  /** Day of month the event ends on, for multi-day events. */
  endDay?: number
} & VariantProps<typeof stampVariants> & { className?: string }) {
  const month = part(date, { month: "short" })
  const day = part(date, { day: "numeric" })
  const weekday = part(date, { weekday: "short" })
  const sub = endDay ? `to ${endDay}` : weekday

  return (
    <time
      dateTime={date.toISOString()}
      className={cn(stampVariants({ size }), className)}
    >
      <b data-month className="block text-[12px] leading-[14px] font-semibold tracking-[0.01em] text-brand">
        {month}
      </b>
      <strong data-day className="block text-[24px] leading-[26px] font-bold tracking-[-0.03em] text-ink">
        {day}
      </strong>
      <span data-sub className="block text-[11px] leading-[13px] font-medium text-muted">
        {sub}
      </span>
    </time>
  )
}

export { DateStamp }
