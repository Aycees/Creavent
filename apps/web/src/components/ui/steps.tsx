import * as React from "react"
import { CheckIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// `.steps`: the onboarding checklist and the application timeline.
type StepState = "done" | "now" | "todo"

function Steps({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol className={cn("m-0 flex list-none flex-col p-0", className)} {...props} />
}

function Step({
  state = "todo",
  title,
  children,
  className,
}: {
  state?: StepState
  title: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <li
      data-state={state}
      aria-current={state === "now" ? "step" : undefined}
      className={cn(
        "group/step relative flex gap-3 pb-5 last:pb-0",
        "before:absolute before:top-6 before:bottom-0 before:left-[11.25px] before:w-[1.5px] before:bg-border before:content-[''] last:before:hidden data-[state=done]:before:bg-ink",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="z-[1] grid size-6 flex-none place-items-center rounded-pill border-[1.5px] border-border-strong bg-surface group-data-[state=done]/step:border-ink group-data-[state=done]/step:bg-ink group-data-[state=done]/step:text-on-inverse group-data-[state=now]/step:border-2 group-data-[state=now]/step:border-ink"
      >
        {state === "done" && <CheckIcon weight="bold" className="size-3" />}
        {state === "now" && <span className="size-2 rounded-pill bg-ink" />}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-label text-ink">
          {title}
          <span className="sr-only">{state === "done" ? ", done" : state === "now" ? ", current step" : ""}</span>
        </span>
        {children && <div className="text-sm text-muted">{children}</div>}
      </div>
    </li>
  )
}

/** `.prog`: the segmented bar at the top of onboarding ("Step 2 of 4"). */
function ProgressBar({ step, total, className }: { step: number; total: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step}
      aria-label={`Step ${step} of ${total}`}
      className={cn("flex gap-1", className)}
    >
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={cn("h-1 flex-1 rounded-[2px] bg-border", i < step && "bg-ink")} />
      ))}
    </div>
  )
}

export { Steps, Step, ProgressBar }
