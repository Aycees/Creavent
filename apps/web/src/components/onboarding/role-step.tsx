"use client"

import type { MeResponse, RoleType } from "@creavent/shared"
import { CalendarBlankIcon, CheckIcon, StorefrontIcon } from "@phosphor-icons/react"
import Link from "next/link"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ChoiceCard } from "@/components/ui/choice-card"
import { api } from "@/lib/api"
import { StepActions, StepHeading } from "./parts"
import { useSave } from "./use-save"

const choices = [
  {
    role: "vendor",
    title: "I sell at events",
    text: "Find markets, apply for a slot, pay the organizer and track it all here. No approval needed.",
    Icon: StorefrontIcon,
  },
  {
    role: "organizer",
    title: "I run events",
    text: "Create events, review vendors and manage slots. Creavent reviews your public pages before you open events to vendors.",
    Icon: CalendarBlankIcon,
  },
] as const

// Step 1, shared by both flows (spec §1.1). The signup choice pre-selects it.
export function RoleStep({ me, wanted }: { me: MeResponse; wanted: RoleType | null }) {
  const existing = me.roles.map((r) => r.role)
  const [picked, setPicked] = React.useState<RoleType[]>(() => [...new Set([...existing, ...(wanted ? [wanted] : [])])])
  const { save, error, saving } = useSave()

  function toggle(role: RoleType) {
    if (existing.includes(role)) return
    setPicked((p) => (p.includes(role) ? p.filter((r) => r !== role) : [...p, role]))
  }

  const order = (roles: RoleType[]) => (["vendor", "organizer"] as const).filter((r) => roles.includes(r))

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="How will you use Creavent?"
        intro={wanted ? `We picked "${choices.find((c) => c.role === wanted)?.title}" from your sign up. Add the other if you do both.` : "Pick one, or both if you sell and run events."}
      />
      <div role="group" aria-label="Roles" className="grid gap-3 md:grid-cols-2 md:gap-4">
        {choices.map(({ role, title, text, Icon }) => {
          const checked = picked.includes(role)
          return (
            <ChoiceCard key={role} className="items-start md:flex-col md:gap-4 md:p-6 md:has-checked:p-[23px]">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={checked}
                disabled={existing.includes(role)}
                onChange={() => toggle(role)}
                aria-describedby={`${role}-text`}
              />
              <span
                aria-hidden="true"
                className="grid size-[22px] flex-none place-items-center rounded-sm border-[1.5px] border-border-strong bg-surface text-on-inverse peer-checked:border-ink peer-checked:bg-ink md:order-2 md:hidden"
              >
                {checked && <CheckIcon weight="bold" className="size-3.5" />}
              </span>
              <span className="flex flex-1 flex-col gap-1">
                <Icon aria-hidden="true" className="hidden size-8 md:block" />
                <span className="text-h3">{title}</span>
                <span id={`${role}-text`} className="text-sm text-muted">
                  {existing.includes(role) ? "You have this role already." : text}
                </span>
              </span>
            </ChoiceCard>
          )
        })}
      </div>
      <p className="text-sm text-muted">
        Just here to shop? You don&apos;t need an account. <Link href="/" className="text-ink underline underline-offset-2">Browse events</Link>
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <StepActions>
        <div className="hidden flex-1 md:block" />
        <Button
          block
          className="md:w-auto md:px-7"
          disabled={saving || picked.length === 0}
          onClick={() => save(api.PUT("/api/onboarding/roles", { body: { roles: order(picked) } }))}
        >
          Continue
        </Button>
      </StepActions>
    </div>
  )
}
