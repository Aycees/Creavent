import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { SiteFooter } from "./site-footer"

describe("SiteFooter", () => {
  it("links to Terms, Privacy, and Support", () => {
    render(<SiteFooter />)

    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms")
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy")
    expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute("href", "/support")
  })
})
