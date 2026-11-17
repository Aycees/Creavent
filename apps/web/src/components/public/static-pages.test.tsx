import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ApprovedView, LegalView, SupportView } from "./static-pages"

const SUPPORT = "support@creavent.example"

// Feature 4.6 (sitemap §3, mockups Approved, Terms, Support).
describe("ApprovedView (/approved)", () => {
  it("says what the review checks, what it doesn't mean, and what to do before paying", () => {
    render(<ApprovedView supportEmail={SUPPORT} />)

    expect(screen.getByRole("heading", { level: 1, name: 'What "Approved by Creavent" means' })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "What we check" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "What it doesn't mean" })).getByText(/It isn't a guarantee/)).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "What it doesn't mean" })).getByText(/doesn't hold or process payments/)).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Before you pay for a slot" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: SUPPORT })).toHaveAttribute("href", `mailto:${SUPPORT}`)
    expect(screen.queryByText(/verified/i)).not.toBeInTheDocument()
  })

  it("explains the badge on pop-up hosts: reviewed pages or a past sale, and no promise the pop-up happens", () => {
    render(<ApprovedView supportEmail={SUPPORT} />)

    const hosts = screen.getByRole("region", { name: "On pop-up hosts" })
    expect(within(hosts).getByText(/We reviewed the shop's social pages/)).toBeInTheDocument()
    expect(within(hosts).getByText(/already sold at a completed event on Creavent/)).toBeInTheDocument()
    expect(within(hosts).getByText(/isn't a promise the pop-up takes place/)).toBeInTheDocument()
  })
})

describe("LegalView (/terms, /privacy)", () => {
  it("shows the terms with their current version and a placeholder notice", () => {
    render(<LegalView kind="terms" version="2026-11-12" minimumAge={18} supportEmail={SUPPORT} />)

    expect(screen.getByRole("heading", { level: 1, name: "Terms of use" })).toBeInTheDocument()
    expect(screen.getByText("Version of Thu, Nov 12, 2026")).toBeInTheDocument()
    expect(screen.getByText(/Placeholder text/)).toBeInTheDocument()
    expect(screen.getByText(/18 or older/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Privacy notice" })).toHaveAttribute("href", "/privacy")
    expect(screen.getByRole("link", { name: "Terms of use" })).toHaveAttribute("aria-current", "page")
    const contents = screen.getByRole("navigation", { name: "On this page" })
    expect(within(contents).getByRole("link", { name: "Payments" })).toHaveAttribute("href", "#payments")
  })

  it("shows the privacy notice, including what is public", () => {
    render(<LegalView kind="privacy" version="2026-11-12" minimumAge={18} supportEmail={SUPPORT} />)

    expect(screen.getByRole("heading", { level: 1, name: "Privacy notice" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "What is public" })).toBeInTheDocument()
    expect(screen.getByText(/phone number, email, applications, documents, and payments are never public/)).toBeInTheDocument()
  })
})

describe("SupportView (/support)", () => {
  it("gives the support email for questions, reports, refunds, and deleting an account", () => {
    render(<SupportView supportEmail={SUPPORT} />)

    expect(screen.getByRole("heading", { level: 1, name: "Support" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Write an email" })).toHaveAttribute("href", `mailto:${SUPPORT}`)
    expect(screen.getByRole("heading", { name: "Report an event or user" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Payments and refunds" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Delete your account" })).toBeInTheDocument()
  })
})
