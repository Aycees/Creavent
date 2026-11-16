import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { CanceledNoticeView, NotPublicView, PublicEventView } from "./public-event"
import { manyVendors, publicEventFixture } from "./fixtures"

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const SUPPORT = "support@creavent.example"

// Feature 4.2: the public view of /events/[slug] (sitemap §3, spec §7).
describe("PublicEventView", () => {
  it("shows the schedule, venue, organizer, and the confirmed vendor count", () => {
    render(<PublicEventView event={publicEventFixture()} supportEmail={SUPPORT} />)

    expect(screen.getByRole("heading", { level: 1, name: "Matina Night Flea" })).toBeInTheDocument()
    expect(screen.getByText("Saturday, Nov 14")).toBeInTheDocument()
    expect(screen.getByText("5 PM to 11 PM")).toBeInTheDocument()
    expect(screen.getByText("Matina Town Square")).toBeInTheDocument()
    expect(screen.getByText("3 vendors confirmed")).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Sari-Sari Collective" })[0]).toHaveAttribute("href", "/organizers/sari-sari-collective")
    expect(screen.getAllByRole("link", { name: /Approved by Creavent/ })[0]).toHaveAttribute("href", "/approved")
    expect(screen.getByText("Details updated Tue, Nov 10")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: SUPPORT })).toHaveAttribute("href", `mailto:${SUPPORT}`)
  })

  it("gets directions from the address, or from the map pin when there is one", () => {
    const { unmount } = render(<PublicEventView event={publicEventFixture()} supportEmail={SUPPORT} />)
    expect(screen.getByRole("link", { name: "Get directions" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=Matina%20Town%20Square%2C%20MacArthur%20Highway%2C%20Matina%2C%20Davao%20City",
    )
    unmount()

    render(<PublicEventView event={publicEventFixture({ latitude: 7.06, longitude: 125.59 })} supportEmail={SUPPORT} />)
    expect(screen.getByRole("link", { name: "Get directions" })).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=7.06%2C125.59")
  })

  it("lists vendors with their category and slot, linking those with a page", () => {
    render(<PublicEventView event={publicEventFixture()} supportEmail={SUPPORT} />)

    const list = screen.getByRole("region", { name: "Who's selling" })
    expect(within(list).getByRole("link", { name: /Lola's Ukay/ })).toHaveAttribute("href", "/vendors/lola-s-ukay")
    expect(within(list).getByText("A-03")).toBeInTheDocument()
    expect(within(list).getByText("Kape Kalinaw")).toBeInTheDocument()
    expect(within(list).queryByRole("link", { name: /Kape Kalinaw/ })).not.toBeInTheDocument()
  })

  it("filters vendors by category", async () => {
    render(<PublicEventView event={publicEventFixture()} supportEmail={SUPPORT} />)
    const list = screen.getByRole("region", { name: "Who's selling" })

    await userEvent.click(within(list).getByRole("button", { name: /Vintage/ }))

    expect(within(list).getByText("Second Spin Records")).toBeInTheDocument()
    expect(within(list).queryByText("Lola's Ukay")).not.toBeInTheDocument()
    expect(within(list).getByRole("button", { name: /Vintage/ })).toHaveAttribute("aria-pressed", "true")
  })

  it("shows the first 9 vendors, then all of them", async () => {
    render(<PublicEventView event={publicEventFixture({ vendors: manyVendors })} supportEmail={SUPPORT} />)
    const list = screen.getByRole("region", { name: "Who's selling" })
    expect(within(list).queryByText("Shop 10")).not.toBeInTheDocument()

    await userEvent.click(within(list).getByRole("button", { name: "Show all 12 vendors" }))

    expect(within(list).getByText("Shop 12")).toBeInTheDocument()
  })

  it("says when no vendors are confirmed yet", () => {
    render(<PublicEventView event={publicEventFixture({ vendors: [] })} supportEmail={SUPPORT} />)

    expect(screen.getByText("The vendor list is coming soon.")).toBeInTheDocument()
  })

  it("marks a completed event as ended, without directions", () => {
    render(<PublicEventView event={publicEventFixture({ status: "completed" })} supportEmail={SUPPORT} />)

    expect(screen.getByText(/This event has ended/)).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Get directions" })).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Who sold here" })).toBeInTheDocument()
  })

  it("marks a canceled event, with the organizer's note and no vendor list", () => {
    render(
      <PublicEventView
        event={publicEventFixture({
          status: "canceled",
          vendors: [],
          canceled: { at: "2026-11-11T03:00:00Z", reason: "Typhoon signal 2." },
        })}
        supportEmail={SUPPORT}
      />,
    )

    expect(screen.getByText(/This event is canceled/)).toBeInTheDocument()
    expect(screen.getByText("Typhoon signal 2.")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Who's selling" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Get directions" })).not.toBeInTheDocument()
  })
})

describe("the other public states", () => {
  it("says an event open to vendors isn't public yet", () => {
    render(<NotPublicView />)

    expect(screen.getByRole("heading", { name: "This event isn't public yet" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Log in as a vendor" })).toHaveAttribute("href", "/login")
  })

  it("shows only the name and dates of an event canceled before it was announced (decision Q2)", () => {
    render(
      <CanceledNoticeView
        name="Pasalubong and Handmade Fair"
        startDate="2026-11-20"
        endDate="2026-11-22"
        opensAt="09:00"
        closesAt="17:00"
        canceled={{ at: "2026-11-18T01:00:00Z", reason: "Venue fell through." }}
      />,
    )

    expect(
      screen.getByRole("heading", {
        name: "Pasalubong and Handmade Fair was canceled",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("Fri, Nov 20 to Sun, Nov 22 · 9 AM to 5 PM daily")).toBeInTheDocument()
    expect(screen.getByText("Venue fell through.")).toBeInTheDocument()
  })
})
