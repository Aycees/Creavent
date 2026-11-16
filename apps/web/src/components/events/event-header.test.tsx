import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { EventSetupPage } from "./event-setup"
import { EVENT_ID, setupFixture } from "./fixtures"

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn(), DELETE: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const ready = { details: true, requirements: true, policy: true, slots: true, payments: true }
let setup = setupFixture()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.GET).mockImplementation((async () => ({ data: setup, response: { status: 200 } })) as never)
})

// The event header shows one next step; navigation is tabs, and the rest is
// under More actions (mockup OrgEventSetup, Phase 4 polish).
describe("event setup header", () => {
  it("on an open event: the page tabs, one next step, and a status line", async () => {
    setup = setupFixture({ status: "open_to_vendors", applicationsOpen: true, checklist: ready })
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    const nav = await screen.findByRole("navigation", { name: "Event" })
    expect(within(nav).getByRole("link", { name: "Applications" })).toHaveAttribute("href", `/organizer/events/${EVENT_ID}/applications`)
    expect(within(nav).getByRole("link", { name: "Vendors and slots" })).toHaveAttribute("href", `/organizer/events/${EVENT_ID}/vendors`)
    expect(within(nav).getByRole("link", { name: "Event setup" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("button", { name: "Announce event" })).toBeInTheDocument()
    expect(screen.getByText("Applications are open. Vendors can find this event and apply. Visitors can't see it yet.")).toBeInTheDocument()
    for (const name of ["Preview as vendor", "Close applications", "Cancel event"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument()
    }
  })

  it("keeps the other actions under More actions", async () => {
    setup = setupFixture({ status: "open_to_vendors", applicationsOpen: true, checklist: ready })
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "More actions" }))

    expect(screen.getByRole("menuitem", { name: "Preview as vendor" })).toHaveAttribute("href", "/events/matina-night-flea-january?preview=vendor")
    expect(screen.getByRole("menuitem", { name: "Close applications" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Cancel event" })).toBeInTheDocument()
  })

  it("on a draft: no page tabs, Open to vendors as the next step, Delete draft in the menu", async () => {
    setup = setupFixture({ checklist: ready })
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByRole("button", { name: "Open to vendors" })).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "Event" })).not.toBeInTheDocument()
    expect(screen.getByText("Only you can see this draft.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "More actions" }))
    expect(screen.getByRole("menuitem", { name: "Delete draft" })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Cancel event" })).not.toBeInTheDocument()
  })

  it("on an announced event: no next-step button, and the status says so", async () => {
    setup = setupFixture({ status: "announced", applicationsOpen: false, checklist: ready })
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByText("Announced, on the event listing. Applications are closed.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Announce|Open to vendors/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "More actions" }))
    expect(screen.getByRole("menuitem", { name: "Open applications" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "See the public page" })).toHaveAttribute("href", "/events/matina-night-flea-january")
  })

  it("keeps the setup sections as tabs", async () => {
    setup = setupFixture({ status: "open_to_vendors", applicationsOpen: true, checklist: ready })
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    const sections = await screen.findByRole("tablist", { name: "Event setup" })
    expect(within(sections).getAllByRole("tab")).toHaveLength(6)
  })
})
