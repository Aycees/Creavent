import * as React from "react"

import { cn } from "@/lib/utils"

// `.kv`: two columns with muted keys on desktop, one column on phones.
function KeyValue({
  items,
  className,
}: {
  items: { key: React.ReactNode; value: React.ReactNode }[]
  className?: string
}) {
  return (
    <dl className={cn("m-0 grid grid-cols-1 gap-x-4 gap-y-2.5 text-sm md:grid-cols-[140px_1fr]", className)}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <dt className="text-muted">{item.key}</dt>
          <dd className="m-0 max-md:mb-1">{item.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

export { KeyValue }
