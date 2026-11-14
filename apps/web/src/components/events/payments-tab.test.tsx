import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { EventSetupPage } from "./event-setup"
import { EVENT_ID, setupFixture } from "./fixtures"

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("tab=payments"), useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

let setup = setupFixture()

beforeEach(() => {
  vi.clearAllMocks()
  setup = setupFixture()
  vi.mocked(api.GET).mockImplementation((async () => ({ data: setup, response: { status: 200 } })) as never)
  vi.mocked(api.PUT).mockImplementation((async () => ({ data: setup, response: { status: 200 } })) as never)
})

describe("Payments tab (spec §6.1)", () => {
  it("shows each payment option and the deadline", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByRole("heading", { name: "Option 1" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "GCash" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByLabelText("GCash number")).toHaveValue("0928 115 7720")
    expect(screen.getByLabelText("Vendors pay within")).toHaveValue(24)
  })

  it("adds a bank option and saves the options and deadline", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Add another option" }))
    expect(screen.getByRole("group", { name: "Option 2" })).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole("button", { name: "Bank transfer" })[1])
    await userEvent.type(screen.getAllByLabelText("Account name")[1], "Joanna Lim")
    await userEvent.type(screen.getAllByLabelText("Account number")[0], "1234 5678 90")
    await userEvent.type(screen.getAllByLabelText(/Note for vendors/)[1], "BPI")
    const hours = screen.getByLabelText("Vendors pay within")
    await userEvent.clear(hours)
    await userEvent.type(hours, "48")
    await userEvent.click(screen.getByRole("button", { name: "Save payment details" }))

    expect(api.PUT).toHaveBeenCalledWith("/api/organizer/events/{id}/payments", {
      params: { path: { id: EVENT_ID } },
      body: {
        deadlineHours: 48,
        methods: [
          { id: "a0a0a0a0-0000-4000-8000-000000000001", channel: "gcash", accountName: "Joanna L.", accountNumber: "0928 115 7720", qrFileId: null, notes: null },
          { channel: "bank", accountName: "Joanna Lim", accountNumber: "1234 5678 90", qrFileId: null, notes: "BPI" },
        ],
      },
    })
  })

  it("removes an option", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.click(await screen.findByRole("button", { name: "Remove option 1" }))
    await userEvent.click(screen.getByRole("button", { name: "Save payment details" }))

    expect(api.PUT).toHaveBeenCalledWith(
      "/api/organizer/events/{id}/payments",
      expect.objectContaining({ body: { deadlineHours: 24, methods: [] } })
    )
  })

  it("needs an account number or a QR", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    await userEvent.clear(await screen.findByLabelText("GCash number"))
    await userEvent.click(screen.getByRole("button", { name: "Save payment details" }))

    expect(await screen.findByText("Add the account number or a QR code")).toBeInTheDocument()
    expect(api.PUT).not.toHaveBeenCalled()
  })

  it("tells vendors that Creavent doesn't hold payments", async () => {
    renderWithQuery(<EventSetupPage id={EVENT_ID} />)

    expect(await screen.findByText(/Creavent doesn't hold or guarantee payments/)).toBeInTheDocument()
  })
})
