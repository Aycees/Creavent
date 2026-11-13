"use client"

import type { MeResponse, OnboardingState, RoleType } from "@creavent/shared"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/ui/container"
import { ProgressBar, Step, Steps } from "@/components/ui/steps"
import { api } from "@/lib/api"
import { onboardingView, type OnboardingView } from "@/lib/onboarding"
import { useMe } from "@/lib/queries"
import { OrganizerDone, VendorDone } from "./done-screens"
import { OrganizerApprovalForm, OrganizerContactStep, OrganizerPageStep } from "./organizer-steps"
import { RoleStep } from "./role-step"
import { onboardingQueryKey, StepSavedContext } from "./use-save"
import { VendorContactStep, VendorPhotosStep, VendorShopStep } from "./vendor-steps"

const stepNames: Record<RoleType, [string, string][]> = {
  vendor: [
    ["Your role", "Vendor, organizer or both"],
    ["Your shop", "Name and categories"],
    ["Photos", "Optional"],
    ["Contact", "For organizers"],
  ],
  organizer: [
    ["Your role", "Vendor, organizer or both"],
    ["Organizer page", "Name, link and city"],
    ["Contact", "Mobile and email"],
    ["Get approved", "Links to your pages"],
  ],
}

export function useOnboardingState() {
  return useQuery({
    queryKey: onboardingQueryKey,
    queryFn: async (): Promise<OnboardingState> => {
      const { data, response } = await api.GET("/api/onboarding")
      if (!data) throw new Error(`GET /api/onboarding failed with ${response.status}`)
      return data
    },
  })
}

function previous(view: OnboardingView): OnboardingView {
  if (view.kind === "vendor" || view.kind === "organizer") {
    return view.step === 2 ? { kind: "role" } : { kind: view.kind, step: (view.step - 1) as 2 | 3 }
  }
  return view
}

// /onboarding (spec §1.1, flow 1). `wanted` is the role the signup choice or
// a "Become a ..." link asks for; `confirmed` shows the email-confirmed note.
export function OnboardingFlow({ wanted, confirmed }: { wanted: RoleType | null; confirmed: boolean }) {
  const { data: me } = useMe()
  const { data: state, isError } = useOnboardingState()
  const [override, setOverride] = React.useState<OnboardingView | null>(null)

  if (isError) return <Alert tone="danger">We couldn&apos;t load your setup. Refresh the page to try again.</Alert>
  if (!me || !state) return <p role="status" className="p-8 text-sm text-muted">Loading…</p>

  const view = override ?? onboardingView(me, wanted)
  return (
    <StepSavedContext.Provider value={() => setOverride(null)}>
      <Container className="pt-6 pb-36 md:pt-12 md:pb-16">
        <FlowBody me={me} state={state} view={view} wanted={wanted} confirmed={confirmed} onBack={() => setOverride(previous(view))} />
      </Container>
    </StepSavedContext.Provider>
  )
}

function FlowBody({
  me,
  state,
  view,
  wanted,
  confirmed,
  onBack,
}: {
  me: MeResponse
  state: OnboardingState
  view: OnboardingView
  wanted: RoleType | null
  confirmed: boolean
  onBack: () => void
}) {
  if (view.kind === "done") {
    return view.role === "vendor" ? <VendorDone me={me} state={state} /> : <OrganizerDone state={state} />
  }

  const flow: RoleType = view.kind === "role" ? (me.roles[0]?.role ?? wanted ?? "vendor") : view.kind
  const step = view.kind === "role" ? 1 : view.step
  const finishLater = (
    <Button asChild variant="ghost" block className="md:w-auto">
      <Link href={flow === "vendor" ? "/vendor" : "/organizer"}>Finish later</Link>
    </Button>
  )
  const props = { state, onBack, finishLater: view.kind === "role" ? null : finishLater }

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-12">
      <nav aria-label="Setup steps" className="hidden w-56 flex-none md:block">
        <Steps>
          {stepNames[flow].map(([title, sub], i) => (
            <Step key={title} title={title} state={i + 1 < step ? "done" : i + 1 === step ? "now" : "todo"}>
              {sub}
            </Step>
          ))}
        </Steps>
        <p className="mt-6 text-cap text-muted">Your progress is saved.</p>
      </nav>
      <section className="flex w-full max-w-[600px] flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted md:text-eyebrow md:uppercase">Step {step} of 4</p>
          <ProgressBar step={step} total={4} className="md:hidden" />
        </div>
        {confirmed && view.kind === "role" && (
          <Alert tone="success">Email confirmed. Welcome, {me.fullName.split(" ")[0]}.</Alert>
        )}
        {view.kind === "role" && <RoleStep me={me} wanted={wanted} />}
        {view.kind === "vendor" && view.step === 2 && <VendorShopStep {...props} />}
        {view.kind === "vendor" && view.step === 3 && <VendorPhotosStep {...props} />}
        {view.kind === "vendor" && view.step === 4 && <VendorContactStep {...props} email={me.email} />}
        {view.kind === "organizer" && view.step === 2 && <OrganizerPageStep {...props} />}
        {view.kind === "organizer" && view.step === 3 && <OrganizerContactStep {...props} />}
        {view.kind === "organizer" && view.step === 4 && <OrganizerApprovalForm {...props} />}
      </section>
    </div>
  )
}
