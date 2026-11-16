import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { renderWithQuery } from "@/test-utils"
import { card, listingFixture } from "./fixtures"
import { ListingView } from "./listing-view"

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }))

const signedOut = () => vi.mocked(api.GET).mockResolvedValue({ data: undefined, response: { status: 401 } } as never)

beforeEach(() => {
  vi.clearAllMocks()
  signedOut()
})

// Feature 4.3: the event listing at / (spec §7.3, flow 10, mockup ListingP4).
describe("ListingView, list", () => {
  it("groups events as This weekend, Next weekend, and Later, each linking to its page", () => {
    renderWithQuery(<ListingView listing={listingFixture()} query={{}} />)

    const thisWeekend = screen.getByRole("region", { name: "This weekend" })
    expect(within(thisWeekend).getByRole("link", { name: /Matina Night Flea/ })).toHaveAttribute("href", "/events/matina-night-flea")
    expect(within(screen.getByRole("region", { name: "Next weekend" })).getByText("Pasalubong and Handmade Fair")).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Next weekend" })).getByText("3 days")).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Later" })).getByText("Paskong Ukay Night")).toBeInTheDocument()
    expect(within(thisWeekend).getByText("Approved")).toBeInTheDocument()
  })

  it("keeps the search words in the box", () => {
    renderWithQuery(<ListingView listing={listingFixture()} query={{ q: "vintage" }} />)

    expect(screen.getByRole("searchbox", { name: "Search events" })).toHaveValue("vintage")
  })

  it("filters by type with links, marking the current one", () => {
    renderWithQuery(<ListingView listing={listingFixture()} query={{ type: "bazaar", when: "weekend" }} />)

    const types = screen.getByRole("navigation", { name: "Event type" })
    expect(within(types).getByRole("link", { name: /All 3/ })).toHaveAttribute("href", "/?when=weekend")
    expect(within(types).getByRole("link", { name: /Bazaars 1/ })).toHaveAttribute("aria-current", "page")
    expect(within(types).getByRole("link", { name: /Flea markets 2/ })).toHaveAttribute("href", "/?type=flea-market&when=weekend")
  })

  it("filters by date from a menu that names the current choice", async () => {
    const user = userEvent.setup()
    renderWithQuery(<ListingView listing={listingFixture()} query={{ type: "bazaar", when: "weekend" }} />)

    await user.click(screen.getByRole("button", { name: /This weekend/ }))
    const menu = screen.getByRole("menu")
    expect(within(menu).getByRole("menuitem", { name: "This weekend" })).toHaveAttribute("aria-current", "true")
    expect(within(menu).getByRole("menuitem", { name: "Any date" })).toHaveAttribute("href", "/?type=bazaar")
    expect(within(menu).getByRole("menuitem", { name: "December" })).toHaveAttribute("href", "/?type=bazaar&when=next_month")
  })

  it("filters by city from a menu, and clears it", async () => {
    const user = userEvent.setup()
    const { unmount } = renderWithQuery(<ListingView listing={listingFixture()} query={{}} />)

    await user.click(screen.getByRole("button", { name: /Any city/ }))
    expect(screen.getByRole("menuitem", { name: "Davao City" })).toHaveAttribute("href", "/?city=Davao+City")
    unmount()

    renderWithQuery(<ListingView listing={listingFixture()} query={{ city: "Davao City" }} />)
    await user.click(screen.getByRole("button", { name: /Davao City/ }))
    expect(screen.getByRole("menuitem", { name: "Davao City" })).toHaveAttribute("aria-current", "true")
    expect(screen.getByRole("menuitem", { name: "Any city" })).toHaveAttribute("href", "/")
  })

  it("marks today and the days with events in the Next 7 days strip", () => {
    renderWithQuery(<ListingView listing={listingFixture()} query={{}} />)

    const strip = screen.getByRole("navigation", { name: "Next 7 days" })
    expect(within(strip).getByRole("link", { name: "Today, Thu, Nov 12, no events" })).toBeInTheDocument()
    expect(within(strip).getByRole("link", { name: "Sat, Nov 14, 1 event" })).toHaveAttribute("href", "/?view=calendar&month=2026-11&day=2026-11-14")
  })

  it("shows Later as a row of cards with its date span and a link to the calendar", () => {
    renderWithQuery(<ListingView listing={listingFixture()} query={{ type: "flea-market" }} />)

    const later = screen.getByRole("region", { name: "Later" })
    expect(within(later).getByText("Dec 5 · 1 event")).toBeInTheDocument()
    expect(within(later).getByRole("link", { name: /Paskong Ukay Night/ })).toHaveAttribute("href", "/events/paskong-ukay-night")
    expect(within(later).getByRole("link", { name: "See all in calendar" })).toHaveAttribute("href", "/?type=flea-market&view=calendar&month=2026-12")
  })

  it("says when nothing matches, with a way out", () => {
    renderWithQuery(<ListingView listing={listingFixture({ events: [] })} query={{ q: "toril", when: "weekend" }} />)

    expect(screen.getByRole("heading", { name: 'No events match "toril" this weekend' })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Show any date" })).toHaveAttribute("href", "/?q=toril")
    expect(screen.getByRole("link", { name: "Clear all" })).toHaveAttribute("href", "/")
  })

  it("invites vendors and organizers, with the count of events taking applications", async () => {
    renderWithQuery(<ListingView listing={listingFixture()} query={{}} />)

    expect(screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "12 events are open to vendors now")).toBeInTheDocument()
    expect(await screen.findByRole("link", { name: "Sell at these events" })).toHaveAttribute("href", "/signup?as=vendor")
    expect(screen.getByRole("link", { name: "Run an event on Creavent" })).toHaveAttribute("href", "/signup?as=organizer")
  })

  it("sends a signed-in vendor to Browse events", async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: { id: "u1", roles: [{ role: "vendor", onboardingStep: 4 }] }, response: { status: 200 } } as never)
    renderWithQuery(<ListingView listing={listingFixture()} query={{}} />)

    await waitFor(() => expect(screen.getByRole("link", { name: "Sell at these events" })).toHaveAttribute("href", "/vendor/events"))
  })
})

describe("ListingView, calendar", () => {
  const month = listingFixture({
    events: [card("Matina Night Flea", "2026-11-14"), card("Pasalubong and Handmade Fair", "2026-11-20", "2026-11-22")],
  })

  it("shows each event on every one of its days, and the selected day's events", () => {
    renderWithQuery(<ListingView listing={month} query={{ view: "calendar", month: "2026-11", day: "2026-11-21" }} />)

    expect(screen.getByRole("heading", { name: "November 2026" })).toBeInTheDocument()
    const grid = screen.getByRole("grid", { name: "November 2026" })
    expect(within(grid).getAllByText("Pasalubong and Handmade Fair")).toHaveLength(3)
    const panel = screen.getByRole("region", { name: "Sat, Nov 21" })
    expect(within(panel).getByRole("link", { name: /Pasalubong and Handmade Fair/ })).toHaveAttribute("href", "/events/pasalubong-and-handmade-fair")
    expect(within(panel).getByText(/Day 2 of 3/)).toBeInTheDocument()
  })

  it("moves between months, keeping the filters", () => {
    renderWithQuery(<ListingView listing={month} query={{ view: "calendar", month: "2026-11", type: "bazaar" }} />)

    expect(screen.getByRole("link", { name: "Next month" })).toHaveAttribute("href", "/?type=bazaar&view=calendar&month=2026-12")
    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute("href", "/?type=bazaar")
  })
})
