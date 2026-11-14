import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { EventSetupPage } from "./event-setup"
import { categories, EVENT_ID, setupFixture } from "./fixtures"

let tab = "requirements"
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(`tab=${tab}`), useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

let setup = setupFixture()

beforeEach(() => {
  vi.clearAllMocks()
  setup = setupFixture()
  vi.mocked(api.GET).mockImplementation((async () => ({ data: setup, response: { status: 200 } })) as never)
  vi.mocked(api.PUT).mockImplementation((async () => ({ data: setup, response: { status: 200 } })) as never)
})

describe("Requirements tab (spec §3.2)", () => {
  beforeEach(() => {
    tab = "requirements"
  })

  it("shows the accepted categories with their limits, and the documents", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByRole("checkbox", { name: "Preloved clothing" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Vintage" })).not.toBeChecked()
    expect(screen.getByLabelText("Limit for Preloved clothing")).toHaveValue(12)
    expect(screen.getByLabelText("Document 1")).toHaveValue("Barangay business clearance")
  })

  it("saves categories, limits, and a document for one category", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("checkbox", { name: "Food and drinks" }))
    await userEvent.type(screen.getByLabelText("Limit for Food and drinks"), "6")
    await userEvent.click(screen.getByRole("button", { name: "Add a document" }))
    await userEvent.type(screen.getByLabelText("Document 2"), "Sanitary permit")
    await userEvent.selectOptions(screen.getByLabelText("Who uploads document 2"), "Food and drinks only")
    await userEvent.click(screen.getByRole("button", { name: "Save requirements" }))

    expect(api.PUT).toHaveBeenCalledWith("/api/organizer/events/{id}/requirements", {
      params: { path: { id: EVENT_ID } },
      body: {
        categories: [
          { categoryId: categories[0].id, maxVendors: 12 },
          { categoryId: categories[2].id, maxVendors: 6 },
        ],
        documents: [
          { id: "d0d0d0d0-0000-4000-8000-000000000001", name: "Barangay business clearance", description: null, categoryId: null },
          { name: "Sanitary permit", description: null, categoryId: categories[2].id },
        ],
      },
    })
  })

  it("removes a document, and offers only accepted categories for one", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    const who = await screen.findByLabelText("Who uploads document 1")
    expect(Array.from((who as HTMLSelectElement).options).map((o) => o.text)).toEqual(["Every vendor", "Preloved clothing only"])
    await userEvent.click(screen.getByRole("button", { name: "Remove document 1" }))
    await userEvent.click(screen.getByRole("button", { name: "Save requirements" }))

    expect(api.PUT).toHaveBeenCalledWith(
      "/api/organizer/events/{id}/requirements",
      expect.objectContaining({ body: expect.objectContaining({ documents: [] }) })
    )
  })

  it("says a category has no limit when the limit is empty", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.clear(await screen.findByLabelText("Limit for Preloved clothing"))
    await userEvent.click(screen.getByRole("button", { name: "Save requirements" }))

    expect(api.PUT).toHaveBeenCalledWith(
      "/api/organizer/events/{id}/requirements",
      expect.objectContaining({ body: expect.objectContaining({ categories: [{ categoryId: categories[0].id, maxVendors: null }] }) })
    )
  })
})

describe("Policy tab (spec §3.7)", () => {
  beforeEach(() => {
    tab = "policy"
  })

  it("says which event the policy was copied from", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByRole("textbox", { name: "Policy" })).toHaveValue("Pay within 24 hours.")
    expect(screen.getByText(/Copied from your last event/)).toHaveTextContent("Bajada Christmas Flea")
  })

  it("starts a first event from the example, to save", async () => {
    setup = setupFixture({ policy: { text: null, copiedFrom: null, example: "Example policy." } })
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByRole("textbox", { name: "Policy" })).toHaveValue("Example policy.")
    expect(screen.getByText(/Edit this example and save it/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Save policy" }))

    expect(api.PUT).toHaveBeenCalledWith("/api/organizer/events/{id}/policy", {
      params: { path: { id: EVENT_ID } },
      body: { text: "Example policy." },
    })
  })
})
