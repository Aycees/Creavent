import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PhoneHeader } from "./phone-header"
import { StickyActionBar } from "./sticky-action-bar"

describe("PhoneHeader", () => {
  it("shows a labeled back link and the page title", () => {
    render(<PhoneHeader title="Bajada Christmas Flea" backHref="/vendor/applications" backLabel="Back to applications" />)

    expect(screen.getByRole("link", { name: "Back to applications" })).toHaveAttribute("href", "/vendor/applications")
    expect(screen.getByRole("heading", { name: "Bajada Christmas Flea" })).toBeInTheDocument()
  })

  it("labels the back link Back by default", () => {
    render(<PhoneHeader title="Event" backHref="/" />)

    expect(screen.getByRole("link", { name: "Back" })).toBeInTheDocument()
  })
})

describe("StickyActionBar", () => {
  it("shows the main action", () => {
    render(
      <StickyActionBar>
        <a href="/directions">Get directions</a>
      </StickyActionBar>
    )

    expect(screen.getByRole("link", { name: "Get directions" })).toBeInTheDocument()
  })
})
