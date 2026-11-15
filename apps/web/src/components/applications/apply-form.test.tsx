import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { useUpload } from "@/lib/use-upload"
import { renderWithQuery } from "@/test-utils"
import { ApplyPage } from "./apply-form"
import { applyFormFixture, CLEARANCE, FOOD, PRELOVED, SANITARY } from "./fixtures"

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }))
vi.mock("@/lib/use-upload", () => ({ useUpload: vi.fn() }))

const push = vi.fn()
const upload = vi.fn()

function serve(form = applyFormFixture()) {
  vi.mocked(api.GET).mockResolvedValue({ data: form, response: { status: 200 } } as never)
}

async function attach(name: string, fileId: string) {
  upload.mockResolvedValueOnce({ id: fileId, purpose: "application_document", url: `/api/files/${fileId}`, width: null, height: null })
  await userEvent.upload(screen.getByLabelText(`Upload ${name}`), new File(["%PDF-"], "permit.pdf", { type: "application/pdf" }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ push } as never)
  vi.mocked(useUpload).mockReturnValue({ upload, pending: false, error: null })
})

describe("ApplyPage (/vendor/events/[slug]/apply)", () => {
  it("shows the vendor's categories with spots left, the documents, and the policy", async () => {
    serve()
    renderWithQuery(<ApplyPage slug="lanang-holiday-flea" />)

    expect(await screen.findByRole("heading", { name: "Apply to sell" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Preloved clothing/ })).toHaveTextContent("5 of 12 spots left")
    expect(screen.getByText("Barangay business clearance")).toBeInTheDocument()
    expect(screen.queryByText("Sanitary permit")).not.toBeInTheDocument()
    expect(screen.getByText("Pay your slot fee within 24 hours of being assigned a slot.")).toBeInTheDocument()
  })

  it("asks for a category's own document once that category is picked", async () => {
    serve()
    renderWithQuery(<ApplyPage slug="lanang-holiday-flea" />)

    await userEvent.click(await screen.findByRole("button", { name: /Food and drinks/ }))

    expect(screen.getByRole("button", { name: /Food and drinks/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("Sanitary permit")).toBeInTheDocument()
  })

  it("marks taken slots, and shows the pick in the summary", async () => {
    serve()
    renderWithQuery(<ApplyPage slug="lanang-holiday-flea" />)

    expect(await screen.findByRole("button", { name: "A-02, taken" })).toBeDisabled()
    await userEvent.click(screen.getByRole("button", { name: "B-01, open" }))

    expect(screen.getByRole("button", { name: "B-01, your pick" })).toHaveAttribute("aria-pressed", "true")
    const summary = screen.getByRole("complementary", { name: "Your application" })
    expect(within(summary).getByText("B-01")).toBeInTheDocument()
    expect(within(summary).getByText("₱1,500")).toBeInTheDocument()
    expect(screen.getByText("Your pick isn't reserved until the organizer assigns it. Other vendors may pick the same slot.")).toBeInTheDocument()
  })

  it("submits the categories, documents, preferred slot, and note, then opens the application", async () => {
    serve()
    vi.mocked(api.POST).mockResolvedValue({ data: { id: "a1" }, response: { status: 201 } } as never)
    renderWithQuery(<ApplyPage slug="lanang-holiday-flea" />)

    await userEvent.click(await screen.findByRole("button", { name: /Preloved clothing/ }))
    await userEvent.click(screen.getByRole("button", { name: /Food and drinks/ }))
    await attach("Barangay business clearance", "f1000000-0000-4000-8000-000000000001")
    await attach("Sanitary permit", "f1000000-0000-4000-8000-000000000002")
    await userEvent.click(screen.getByRole("button", { name: "A-01, open" }))
    await userEvent.type(screen.getByLabelText(/Note to the organizer/), "Near the clothing stalls")
    await userEvent.click(screen.getByRole("button", { name: "Submit application" }))

    expect(api.POST).toHaveBeenCalledWith("/api/vendor/events/{slug}/applications", {
      params: { path: { slug: "lanang-holiday-flea" } },
      body: {
        categoryIds: [PRELOVED, FOOD],
        documents: [
          { requirementId: CLEARANCE, fileIds: ["f1000000-0000-4000-8000-000000000001"] },
          { requirementId: SANITARY, fileIds: ["f1000000-0000-4000-8000-000000000002"] },
        ],
        slotsRequested: 1,
        preferredSlotIds: ["5a000000-0000-4000-8000-000000000001"],
        note: "Near the clothing stalls",
      },
    })
    expect(push).toHaveBeenCalledWith("/vendor/applications/a1")
  })

  it("asks for a category and the required documents before sending", async () => {
    serve()
    renderWithQuery(<ApplyPage slug="lanang-holiday-flea" />)

    await userEvent.click(await screen.findByRole("button", { name: "Submit application" }))
    expect(await screen.findByText("Pick at least one category")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /Preloved clothing/ }))
    await userEvent.click(screen.getByRole("button", { name: "Submit application" }))
    expect(await screen.findByText("Upload your Barangay business clearance")).toBeInTheDocument()
    expect(api.POST).not.toHaveBeenCalled()
  })

  it("shows the API's reason when the application is refused", async () => {
    serve(applyFormFixture({ documents: [] }))
    vi.mocked(api.POST).mockResolvedValue({ error: { message: "Applications are closed for this event" }, response: { status: 409 } } as never)
    renderWithQuery(<ApplyPage slug="lanang-holiday-flea" />)

    await userEvent.click(await screen.findByRole("button", { name: /Preloved clothing/ }))
    await userEvent.click(screen.getByRole("button", { name: "Submit application" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Applications are closed for this event")
  })

  it("links to the existing application instead of the form", async () => {
    serve(applyFormFixture({ blocked: "already_applied", activeApplicationId: "a9" }))
    renderWithQuery(<ApplyPage slug="lanang-holiday-flea" />)

    expect(await screen.findByText("You already applied to this event.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "See your application" })).toHaveAttribute("href", "/vendor/applications/a9")
    expect(screen.queryByRole("button", { name: "Submit application" })).not.toBeInTheDocument()
  })

  it("says when applications are closed or the vendor can't reapply", async () => {
    serve(applyFormFixture({ blocked: "cannot_reapply" }))
    renderWithQuery(<ApplyPage slug="lanang-holiday-flea" />)

    expect(await screen.findByText("You can't reapply to this event.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to the event" })).toHaveAttribute("href", "/events/lanang-holiday-flea")
  })

  it("asks how many slots only when the event allows more than one", async () => {
    serve()
    renderWithQuery(<ApplyPage slug="lanang-holiday-flea" />)

    await screen.findByRole("heading", { name: "Apply to sell" })
    expect(screen.queryByRole("radiogroup", { name: "How many slots?" })).not.toBeInTheDocument()
  })

  it("picks up to as many preferred slots as the vendor needs, with the total", async () => {
    const form = applyFormFixture({ event: { ...applyFormFixture().event, maxSlotsPerVendor: 3 } })
    form.slotGroups[1].slots.push({ id: "5a000000-0000-4000-8000-000000000004", label: "B-02", sizeLabel: "3 × 3 m", note: null, price: 1500, taken: false })
    serve(form)
    vi.mocked(api.POST).mockResolvedValue({ data: { id: "a1" }, response: { status: 201 } } as never)
    renderWithQuery(<ApplyPage slug="lanang-holiday-flea" />)

    const count = await screen.findByRole("radiogroup", { name: "How many slots?" })
    await userEvent.click(within(count).getByRole("radio", { name: "2" }))
    expect(screen.getByRole("heading", { name: /Preferred slots/ })).toBeInTheDocument()
    expect(screen.getByText("Your picks aren't reserved until the organizer assigns them. Other vendors may pick the same slots.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "A-01, open" }))
    await userEvent.click(screen.getByRole("button", { name: "B-01, open" }))
    // Full: a third pick waits until one is unpicked.
    await userEvent.click(screen.getByRole("button", { name: "B-02, open" }))
    expect(screen.getByRole("button", { name: "B-02, open" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("2 of 2 picked. Tap a pick to change it.")).toBeInTheDocument()
    const summary = screen.getByRole("complementary", { name: "Your application" })
    expect(within(summary).getByText("2 slots")).toBeInTheDocument()
    expect(within(summary).getByText("A-01, B-01")).toBeInTheDocument()
    expect(within(summary).getByText("₱2,300")).toBeInTheDocument()

    // Fewer slots drops the extra picks.
    await userEvent.click(within(count).getByRole("radio", { name: "1" }))
    expect(screen.getByRole("button", { name: "B-01, open" })).toHaveAttribute("aria-pressed", "false")
    await userEvent.click(within(count).getByRole("radio", { name: "2" }))
    await userEvent.click(screen.getByRole("button", { name: "B-02, open" }))
    await userEvent.click(screen.getByRole("button", { name: /Preloved clothing/ }))
    await attach("Barangay business clearance", "f1000000-0000-4000-8000-000000000001")
    await userEvent.click(screen.getByRole("button", { name: "Submit application" }))

    expect(api.POST).toHaveBeenCalledWith("/api/vendor/events/{slug}/applications", {
      params: { path: { slug: "lanang-holiday-flea" } },
      body: expect.objectContaining({
        slotsRequested: 2,
        preferredSlotIds: ["5a000000-0000-4000-8000-000000000001", "5a000000-0000-4000-8000-000000000004"],
      }),
    })
  })

  it("asks how many slots even when the organizer assigns them", async () => {
    serve(applyFormFixture({ event: { ...applyFormFixture().event, preferredSlots: false, maxSlotsPerVendor: 2 }, slotGroups: [] }))
    vi.mocked(api.POST).mockResolvedValue({ data: { id: "a1" }, response: { status: 201 } } as never)
    renderWithQuery(<ApplyPage slug="lanang-holiday-flea" />)

    await userEvent.click(within(await screen.findByRole("radiogroup", { name: "How many slots?" })).getByRole("radio", { name: "2" }))
    await userEvent.click(screen.getByRole("button", { name: /Preloved clothing/ }))
    await attach("Barangay business clearance", "f1000000-0000-4000-8000-000000000001")
    await userEvent.click(screen.getByRole("button", { name: "Submit application" }))

    expect(api.POST).toHaveBeenCalledWith("/api/vendor/events/{slug}/applications", {
      params: { path: { slug: "lanang-holiday-flea" } },
      body: expect.objectContaining({ slotsRequested: 2, preferredSlotIds: [] }),
    })
  })

  it("hides the preferred slot section when the organizer assigns slots", async () => {
    serve(applyFormFixture({ event: { ...applyFormFixture().event, preferredSlots: false }, slotGroups: [] }))
    renderWithQuery(<ApplyPage slug="lanang-holiday-flea" />)

    await screen.findByRole("heading", { name: "Apply to sell" })
    expect(screen.queryByRole("heading", { name: /Preferred slot/ })).not.toBeInTheDocument()
  })
})
