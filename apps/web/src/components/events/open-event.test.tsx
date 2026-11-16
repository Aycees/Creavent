import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { EventSetupPage } from "./event-setup"
import { EVENT_ID, setupFixture } from "./fixtures"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push }) }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn(), DELETE: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

let setup = setupFixture()
const ready = { details: true, requirements: true, policy: true, slots: true, payments: true }

beforeEach(() => {
  vi.clearAllMocks()
  setup = setupFixture()
  vi.mocked(api.GET).mockImplementation((async () => ({ data: setup, response: { status: 200 } })) as never)
})

describe("Open to vendors (spec §3.1, flow 3)", () => {
  it("counts the required steps and links to what's missing", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    const list = await screen.findByRole("region", { name: "Before you open to vendors" })
    expect(within(list).getByText("4 of 5 required steps done")).toBeInTheDocument()
    expect(within(list).getByRole("button", { name: "Add payment details" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open to vendors" })).toBeDisabled()
  })

  it("switches to the missing step's tab", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Add payment details" }))

    expect(screen.getByRole("tab", { name: /Payments/ })).toHaveAttribute("aria-selected", "true")
  })

  it("says the organizer must be approved first", async () => {
    setup = setupFixture({ checklist: ready, organizerApproved: false })
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByRole("button", { name: "Open to vendors" })).toBeDisabled()
    expect(screen.getByRole("link", { name: "Get approved to open this event to vendors" })).toHaveAttribute("href", "/organizer/approval")
  })

  it("opens a ready event after confirming", async () => {
    setup = setupFixture({ checklist: ready })
    vi.mocked(api.POST).mockResolvedValue({ data: { ...setup, status: "open_to_vendors", applicationsOpen: true }, response: { status: 201 } } as never)
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Open to vendors" }))
    const dialog = await screen.findByRole("dialog", { name: "Open this event to vendors?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Open to vendors" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events/{id}/open", { params: { path: { id: EVENT_ID } } })
    expect(await screen.findByText("Open to vendors", { selector: "span" })).toBeInTheDocument()
  })

  it("links to the vendor preview", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByRole("link", { name: "Preview as vendor" })).toHaveAttribute("href", "/events/matina-night-flea-january?preview=vendor")
  })
})

describe("applications on an open event", () => {
  it("closes applications", async () => {
    setup = setupFixture({ checklist: ready, status: "open_to_vendors", applicationsOpen: true })
    vi.mocked(api.PUT).mockResolvedValue({ data: { ...setup, applicationsOpen: false }, response: { status: 200 } } as never)
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByText("Vendors can find this event and apply. Visitors can't see it yet.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Close applications" }))

    expect(api.PUT).toHaveBeenCalledWith("/api/organizer/events/{id}/applications", { params: { path: { id: EVENT_ID } }, body: { open: false } })
    expect(await screen.findByRole("button", { name: "Open applications" })).toBeInTheDocument()
  })
})

describe("deleting a draft", () => {
  it("deletes a draft after confirming, and goes back to the dashboard", async () => {
    vi.mocked(api.DELETE).mockResolvedValue({ response: { status: 204 } } as never)
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Delete draft" }))
    const dialog = await screen.findByRole("dialog", { name: "Delete this draft?" })
    expect(dialog).toHaveTextContent("This can't be undone.")
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete draft" }))

    expect(api.DELETE).toHaveBeenCalledWith("/api/organizer/events/{id}", { params: { path: { id: EVENT_ID } } })
    expect(push).toHaveBeenCalledWith("/organizer")
  })

  it("keeps the draft when the organizer changes their mind", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Delete draft" }))
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Keep draft" }))

    expect(api.DELETE).not.toHaveBeenCalled()
  })

  it("offers no delete once the event is open to vendors", async () => {
    setup = setupFixture({ checklist: ready, status: "open_to_vendors", applicationsOpen: true })
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await screen.findByText(/Vendors can find this event and apply/)
    expect(screen.queryByRole("button", { name: "Delete draft" })).not.toBeInTheDocument()
  })
})
