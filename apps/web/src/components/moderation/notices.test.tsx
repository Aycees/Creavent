import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { signedInMe } from "@/test-utils"
import { HiddenEventNotice, SuspendedNotice } from "./notices"

const vendorRole = { role: "vendor" as const, approvalStatus: null, rejectionReason: null, onboardingStep: 4, suspended: false, suspensionReason: null }

// Feature 5.2: what a suspended or hidden user sees (mockup SuspendedVendorPhone, OrgEventHiddenPhone).
describe("SuspendedNotice", () => {
  it("shows the reason and what the role can't do, with a way to contact support", () => {
    render(<SuspendedNotice me={{ ...signedInMe, roles: [{ ...vendorRole, suspended: true, suspensionReason: "Took a deposit and didn't attend" }] }} role="vendor" />)

    expect(screen.getByText("Your vendor role is suspended")).toBeInTheDocument()
    expect(screen.getByText(/Took a deposit and didn't attend/)).toBeInTheDocument()
    expect(screen.getByText(/can't apply to events or change your slots/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Contact support" })).toHaveAttribute("href", "/support")
  })

  it("shows nothing for a role in good standing", () => {
    const { container } = render(<SuspendedNotice me={{ ...signedInMe, roles: [vendorRole] }} role="vendor" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe("HiddenEventNotice", () => {
  it("tells the organizer why their event is hidden", () => {
    render(<HiddenEventNotice audience="organizer" reason="Photos match another event" />)

    expect(screen.getByText("Creavent hid this event")).toBeInTheDocument()
    expect(screen.getByText(/Photos match another event/)).toBeInTheDocument()
    expect(screen.getByText(/can't edit it or act on applications/)).toBeInTheDocument()
  })

  it("tells the vendor nothing can change for now, without the reason", () => {
    render(<HiddenEventNotice audience="vendor" />)

    expect(screen.getByText("Creavent hid this event while it reviews a report")).toBeInTheDocument()
    expect(screen.getByText(/can't release, pay for, or change your slot/)).toBeInTheDocument()
  })
})
