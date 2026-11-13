import type { MeResponse, OnboardingState } from "@creavent/shared"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery, signedInMe } from "@/test-utils"
import { OnboardingFlow } from "./onboarding-flow"

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn() } }))

const categories = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Preloved clothing" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Vintage" },
]
const emptyState: OnboardingState = { categories, phone: null, avatar: null, vendor: null, organizer: null }

function role(role: "vendor" | "organizer", onboardingStep: number) {
  return { role, onboardingStep, approvalStatus: role === "organizer" ? ("not_submitted" as const) : null, rejectionReason: null, suspended: false, suspensionReason: null }
}

function serve(me: MeResponse, state: OnboardingState = emptyState) {
  vi.mocked(api.GET).mockImplementation((async (path: string) => ({
    data: path === "/api/me" ? me : state,
    response: { status: 200 },
  })) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ replace: vi.fn(), push: vi.fn() } as never)
})

describe("OnboardingFlow", () => {
  it("asks how the user will use Creavent, pre-selected from the signup choice", async () => {
    serve(signedInMe)
    renderWithQuery(<OnboardingFlow wanted="organizer" confirmed />)

    expect(await screen.findByRole("heading", { name: "How will you use Creavent?" })).toBeInTheDocument()
    expect(screen.getByText("Email confirmed. Welcome, Maria.")).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /I run events/ })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /I sell at events/ })).not.toBeChecked()
  })

  it("adds the chosen roles on Continue", async () => {
    serve(signedInMe)
    vi.mocked(api.PUT).mockResolvedValue({ data: emptyState, response: { status: 200 } } as never)
    renderWithQuery(<OnboardingFlow wanted="vendor" confirmed={false} />)

    await userEvent.click(await screen.findByRole("checkbox", { name: /I run events/ }))
    await userEvent.click(screen.getByRole("button", { name: "Continue" }))

    expect(api.PUT).toHaveBeenCalledWith("/api/onboarding/roles", { body: { roles: ["vendor", "organizer"] } })
  })

  it("shows the vendor shop step with its progress, and needs a name and a category", async () => {
    serve({ ...signedInMe, roles: [role("vendor", 1)] })
    renderWithQuery(<OnboardingFlow wanted={null} confirmed={false} />)

    expect(await screen.findByRole("heading", { name: "Tell us about your shop" })).toBeInTheDocument()
    expect(screen.getAllByText("Step 2 of 4").length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole("button", { name: "Continue" }))

    expect(await screen.findByText("Enter your shop name")).toBeInTheDocument()
    expect(screen.getByText("Pick at least one category")).toBeInTheDocument()
    expect(api.PUT).not.toHaveBeenCalled()
  })

  it("saves the shop with the picked categories", async () => {
    serve({ ...signedInMe, roles: [role("vendor", 1)] })
    vi.mocked(api.PUT).mockResolvedValue({ data: emptyState, response: { status: 200 } } as never)
    renderWithQuery(<OnboardingFlow wanted={null} confirmed={false} />)

    await userEvent.type(await screen.findByLabelText("Shop name"), "Lola's Ukay")
    await userEvent.click(screen.getByRole("button", { name: "Vintage" }))
    await userEvent.click(screen.getByRole("button", { name: "Continue" }))

    expect(api.PUT).toHaveBeenCalledWith("/api/onboarding/vendor/shop", {
      body: { shopName: "Lola's Ukay", categoryIds: [categories[1].id], description: "", products: "" },
    })
  })

  it("submits an organizer for review from the last step", async () => {
    serve({ ...signedInMe, roles: [role("organizer", 3)] }, {
      ...emptyState,
      organizer: { displayName: "Bazaar ng Mintal", slug: "bazaar-ng-mintal", logo: null, city: null, about: null, socialLinks: [], contactEmail: "b@example.com", approvalStatus: "not_submitted", approvalSubmittedAt: null, reviewedAt: null, rejectionReason: null, reviewedLinks: [] },
    })
    vi.mocked(api.POST).mockResolvedValue({ data: emptyState, response: { status: 200 } } as never)
    renderWithQuery(<OnboardingFlow wanted={null} confirmed={false} />)

    await userEvent.type(await screen.findByLabelText("Link to your page or a past event"), "facebook.com/bazaarngmintal")
    await userEvent.click(screen.getByRole("button", { name: "Add link" }))
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }))

    expect(api.POST).toHaveBeenCalledWith("/api/onboarding/organizer/approval", {
      body: { socialLinks: ["facebook.com/bazaarngmintal"], submit: true },
    })
  })

  it('saves the links without a review on "Do this later"', async () => {
    serve({ ...signedInMe, roles: [role("organizer", 3)] }, {
      ...emptyState,
      organizer: { displayName: "B", slug: "bbb", logo: null, city: null, about: null, socialLinks: ["https://facebook.com/b"], contactEmail: "b@example.com", approvalStatus: "not_submitted", approvalSubmittedAt: null, reviewedAt: null, rejectionReason: null, reviewedLinks: [] },
    })
    vi.mocked(api.POST).mockResolvedValue({ data: emptyState, response: { status: 200 } } as never)
    renderWithQuery(<OnboardingFlow wanted={null} confirmed={false} />)

    await userEvent.click(await screen.findByRole("button", { name: "Do this later" }))

    expect(api.POST).toHaveBeenCalledWith("/api/onboarding/organizer/approval", {
      body: { socialLinks: ["https://facebook.com/b"], submit: false },
    })
  })

  it("shows the pending review screen after an organizer submitted", async () => {
    serve({ ...signedInMe, roles: [{ ...role("organizer", 4), approvalStatus: "pending_review" }] }, {
      ...emptyState,
      organizer: { displayName: "Bazaar ng Mintal", slug: "bazaar-ng-mintal", logo: null, city: null, about: null, socialLinks: ["https://facebook.com/b"], contactEmail: "b@example.com", approvalStatus: "pending_review", approvalSubmittedAt: "2026-11-13T07:40:00.000Z", reviewedAt: null, rejectionReason: null, reviewedLinks: [] },
    })
    renderWithQuery(<OnboardingFlow wanted={null} confirmed={false} />)

    expect(await screen.findByText("Pending review")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Create your first event as a draft/ })).toHaveAttribute("href", "/organizer/events/new")
  })
})
