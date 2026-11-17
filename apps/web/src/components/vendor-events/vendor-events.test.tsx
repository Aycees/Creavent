import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { BrowseEvents } from "./browse-events"
import { EventPageView } from "./event-page"
import { popupEventFixture, publicEventFixture } from "../public/fixtures"
import { cardFixture, eventFixture } from "./fixtures"

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("BrowseEvents (/vendor/events)", () => {
  beforeEach(() => {
    vi.mocked(api.GET).mockResolvedValue({ data: { events: [cardFixture()] }, response: { status: 200 } } as never)
  })

  it("shows each event with its fee, spots left, and tags", async () => {
    renderWithQuery(<BrowseEvents />)

    const card = await screen.findByRole("article", { name: "Lanang Holiday Flea" })
    expect(within(card).getByRole("link", { name: "Lanang Holiday Flea" })).toHaveAttribute("href", "/events/lanang-holiday-flea")
    expect(within(card).getByText("Fri, Dec 18 to Sun, Dec 20 · 3 PM to 11 PM daily · Damosa Gateway")).toBeInTheDocument()
    expect(within(card).getByText("₱800 to ₱1,500")).toBeInTheDocument()
    expect(within(card).getByText("Preloved clothing: 5 of 12 spots left")).toBeInTheDocument()
    expect(within(card).getByText("Choose a preferred slot")).toBeInTheDocument()
    expect(within(card).getByText("Applications close Thu, Dec 10, 11:59 PM")).toBeInTheDocument()
    expect(screen.getByText("1 event, soonest first")).toBeInTheDocument()
  })

  it("shows the vendor's own status at the event", async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: { events: [cardFixture({ myStatus: "slot_assigned" })] }, response: { status: 200 } } as never)
    renderWithQuery(<BrowseEvents />)

    const card = await screen.findByRole("article", { name: "Lanang Holiday Flea" })
    expect(within(card).getByText("You: Slot assigned")).toBeInTheDocument()
  })

  it("makes the whole card one link to the event page", async () => {
    renderWithQuery(<BrowseEvents />)

    const card = await screen.findByRole("article", { name: "Lanang Holiday Flea" })
    const links = within(card).getAllByRole("link")
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute("href", "/events/lanang-holiday-flea")
    expect(links[0]).toHaveClass("after:absolute", "after:inset-0")
  })

  it("filters by search, date, and city", async () => {
    renderWithQuery(<BrowseEvents />)
    await screen.findByRole("article")

    await userEvent.type(screen.getByRole("searchbox", { name: "Search events" }), "matina")
    await userEvent.click(screen.getByRole("button", { name: "This weekend" }))
    await userEvent.selectOptions(screen.getByLabelText("City"), "Davao City")

    await waitFor(() =>
      expect(api.GET).toHaveBeenLastCalledWith("/api/vendor/events", { params: { query: { q: "matina", when: "weekend", city: "Davao City" } } })
    )
  })

  it("says when nothing matches", async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: { events: [] }, response: { status: 200 } } as never)
    renderWithQuery(<BrowseEvents />)

    expect(await screen.findByText("No events match. Try another date or city.")).toBeInTheDocument()
  })
})

describe("EventPageView (/events/[slug])", () => {
  // Signed in: /api/me answers, then the viewer's own page.
  const show = (data: unknown, status = 200) =>
    vi.mocked(api.GET).mockImplementation((async (path: string) =>
      path === "/api/me" ? { data: { id: "u1" }, response: { status: 200 } } : { data, response: { status } }) as never)
  const server = <p>Server-rendered public page</p>

  it("shows a vendor the requirements, slots, policy, summary, and contact", async () => {
    show({ view: "vendor", preview: false, event: eventFixture() })
    renderWithQuery(<EventPageView slug="lanang-holiday-flea" supportEmail="support@creavent.example">{server}</EventPageView>)

    expect(await screen.findByRole("heading", { level: 1, name: "Lanang Holiday Flea" })).toBeInTheDocument()
    expect(screen.getByText(/Vendor view. This event is open to vendors/)).toBeInTheDocument()
    expect(screen.getByText("Your category, Preloved clothing, is accepted. 5 of 12 spots for this category are left.")).toBeInTheDocument()
    const slots = screen.getByRole("region", { name: /Slots and prices/ })
    expect(within(slots).getByText("Main walkway")).toBeInTheDocument()
    expect(within(slots).getByText("9 of 16")).toBeInTheDocument()
    expect(within(slots).getByText("You can choose a preferred slot when you apply. The organizer assigns your slot after approving you.")).toBeInTheDocument()
    expect(screen.getByText("Sanitary permit · Food and drinks only")).toBeInTheDocument()
    expect(screen.getByText("Pay within 24 hours.")).toBeInTheDocument()
    expect(screen.getByText("Rhea Montemayor · 0917 482 1093")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Apply as vendor" })).toHaveAttribute("href", "/vendor/events/lanang-holiday-flea/apply")
  })

  it("replaces Apply with Applications closed", async () => {
    show({ view: "vendor", preview: false, event: eventFixture({ acceptingApplications: false }) })
    renderWithQuery(<EventPageView slug="lanang-holiday-flea" supportEmail="support@creavent.example">{server}</EventPageView>)

    expect(await screen.findByText("Applications closed")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Apply as vendor" })).not.toBeInTheDocument()
  })

  it("shows the vendor's status and a link to their application instead of Apply", async () => {
    show({ view: "vendor", preview: false, event: eventFixture({ myApplication: { id: "a1", status: "submitted", canReapply: null } }) })
    renderWithQuery(<EventPageView slug="lanang-holiday-flea" supportEmail="support@creavent.example">{server}</EventPageView>)

    expect(await screen.findByText("Your application: Submitted")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View your application" })).toHaveAttribute("href", "/vendor/applications/a1")
    expect(screen.queryByRole("link", { name: "Apply as vendor" })).not.toBeInTheDocument()
  })

  it("offers Apply again after a decline or withdrawal", async () => {
    show({ view: "vendor", preview: false, event: eventFixture({ myApplication: { id: "a1", status: "declined", canReapply: null } }) })
    renderWithQuery(<EventPageView slug="lanang-holiday-flea" supportEmail="support@creavent.example">{server}</EventPageView>)

    expect(await screen.findByText("Your application: Declined")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Apply again" })).toHaveAttribute("href", "/vendor/events/lanang-holiday-flea/apply")
  })

  it("tells a removed vendor whether they can apply again", async () => {
    show({ view: "vendor", preview: false, event: eventFixture({ myApplication: { id: "a1", status: "removed", canReapply: false } }) })
    const { unmount } = renderWithQuery(<EventPageView slug="lanang-holiday-flea" supportEmail="support@creavent.example">{server}</EventPageView>)

    expect(await screen.findByText("You can't reapply to this event.")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /Apply/ })).not.toBeInTheDocument()
    unmount()

    show({ view: "vendor", preview: false, event: eventFixture({ myApplication: { id: "a1", status: "removed", canReapply: true } }) })
    renderWithQuery(<EventPageView slug="lanang-holiday-flea" supportEmail="support@creavent.example">{server}</EventPageView>)
    expect(await screen.findByRole("link", { name: "Apply again" })).toHaveAttribute("href", "/vendor/events/lanang-holiday-flea/apply")
  })

  it("says when the vendor's category isn't accepted", async () => {
    show({ view: "vendor", preview: false, event: eventFixture({ myCategoryIds: ["c1c1c1c1-0000-4000-8000-000000000009"] }) })
    renderWithQuery(<EventPageView slug="lanang-holiday-flea" supportEmail="support@creavent.example">{server}</EventPageView>)

    expect(await screen.findByText("Your categories aren't accepted at this event. Check the list below before you apply.")).toBeInTheDocument()
  })

  it("marks the organizer's preview", async () => {
    show({ view: "vendor", preview: true, event: eventFixture({ status: "draft" }) })
    renderWithQuery(<EventPageView slug="lanang-holiday-flea" supportEmail="support@creavent.example">{server}</EventPageView>)

    expect(await screen.findByText("Preview: this is what vendors see. This event is a draft, so only you can see it.")).toBeInTheDocument()
  })

  it("keeps the server-rendered page for visitors, without asking for a personal view", async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: undefined, response: { status: 401 } } as never)
    renderWithQuery(<EventPageView slug="lanang-holiday-flea" supportEmail="support@creavent.example">{server}</EventPageView>)

    expect(await screen.findByText("Server-rendered public page")).toBeInTheDocument()
    await waitFor(() => expect(api.GET).toHaveBeenCalledWith("/api/me"))
    expect(api.GET).not.toHaveBeenCalledWith("/api/events/{slug}", expect.anything())
  })

  it("keeps the server-rendered page for other signed-in users", async () => {
    show({ view: "not_public" })
    renderWithQuery(<EventPageView slug="lanang-holiday-flea" supportEmail="support@creavent.example">{server}</EventPageView>)

    await waitFor(() => expect(api.GET).toHaveBeenCalledWith("/api/events/{slug}", expect.anything()))
    expect(screen.getByText("Server-rendered public page")).toBeInTheDocument()
  })

  it("shows the event's organizer the public view with Manage event", async () => {
    show({ view: "public", manage: { eventId: "e1", popup: false }, event: publicEventFixture({ status: "open_to_vendors" }) })
    renderWithQuery(<EventPageView slug="matina-night-flea" supportEmail="support@creavent.example">{server}</EventPageView>)

    expect(await screen.findByText("Your event, as visitors will see it")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Manage event" })).toHaveAttribute("href", "/organizer/events/e1")
    expect(screen.getByRole("link", { name: "Preview as vendor" })).toHaveAttribute("href", "/events/matina-night-flea?preview=vendor")
    expect(screen.getByRole("heading", { level: 1, name: "Matina Night Flea" })).toBeInTheDocument()
    expect(screen.queryByText("Server-rendered public page")).not.toBeInTheDocument()
  })

  it("shows a pop-up's host the public view with Manage pop-up, and no vendor preview", async () => {
    show({ view: "public", manage: { eventId: "p1", popup: true }, event: popupEventFixture() })
    renderWithQuery(<EventPageView slug="lolas-ukay-at-habi-cafe" supportEmail="support@creavent.example">{server}</EventPageView>)

    expect(await screen.findByText("Your pop-up, as visitors will see it")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Manage pop-up" })).toHaveAttribute("href", "/vendor/popups/p1")
    expect(screen.queryByRole("link", { name: "Preview as vendor" })).not.toBeInTheDocument()
  })

  it("keeps the server page when the event isn't found for this viewer", async () => {
    show(undefined, 404)
    renderWithQuery(<EventPageView slug="nope" supportEmail="support@creavent.example">{server}</EventPageView>)

    await waitFor(() => expect(api.GET).toHaveBeenCalledWith("/api/events/{slug}", expect.anything()))
    expect(screen.getByText("Server-rendered public page")).toBeInTheDocument()
  })
})
