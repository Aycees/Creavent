import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { CreateEvent } from "./create-event"
import { eventTypes } from "./fixtures"

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }))
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }))


const push = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ push } as never)
  vi.mocked(api.GET).mockResolvedValue({ data: { eventTypes }, response: { status: 200 } } as never)
})

describe("CreateEvent (/organizer/events/new)", () => {
  it("asks for the name and type, with Flea market picked", async () => {
    renderWithQuery(<CreateEvent />)

    expect(await screen.findByRole("radio", { name: "Flea market" })).toBeChecked()
    expect(screen.getByLabelText("Event name")).toBeInTheDocument()
  })

  it("creates the draft and opens its setup", async () => {
    vi.mocked(api.POST).mockResolvedValue({ data: { id: "e1" }, response: { status: 201 } } as never)
    renderWithQuery(<CreateEvent />)

    await userEvent.type(await screen.findByLabelText("Event name"), "Matina Night Flea")
    await userEvent.click(screen.getByRole("radio", { name: "Bazaar" }))
    await userEvent.click(screen.getByRole("button", { name: "Create draft" }))

    expect(api.POST).toHaveBeenCalledWith("/api/organizer/events", {
      body: { name: "Matina Night Flea", eventTypeId: eventTypes[1].id },
    })
    expect(push).toHaveBeenCalledWith("/organizer/events/e1")
  })

  it("needs a name", async () => {
    renderWithQuery(<CreateEvent />)

    await userEvent.click(await screen.findByRole("button", { name: "Create draft" }))

    expect(await screen.findByText("Enter the event name")).toBeInTheDocument()
    expect(api.POST).not.toHaveBeenCalled()
  })

  it("sends an organizer who hasn't finished onboarding back to it", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      error: { message: "Finish your organizer page and contact number first" },
      response: { status: 403 },
    } as never)
    renderWithQuery(<CreateEvent />)

    await userEvent.type(await screen.findByLabelText("Event name"), "Matina Night Flea")
    await userEvent.click(screen.getByRole("button", { name: "Create draft" }))

    expect(await screen.findByText("Finish your organizer page and contact number first")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Finish onboarding" })).toHaveAttribute("href", "/onboarding?role=organizer")
  })
})
