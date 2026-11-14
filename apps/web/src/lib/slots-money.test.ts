import { formatPeso, formatPriceRange, groupSlots, rowLabels } from "@creavent/shared"
import { describe, expect, it } from "vitest"

describe("formatPeso (design brief §4)", () => {
  it("uses the peso sign and comma thousands, and says Free for zero", () => {
    expect(formatPeso(1500)).toBe("₱1,500")
    expect(formatPeso(350.5)).toBe("₱350.50")
    expect(formatPeso(0)).toBe("Free")
  })

  it("reads a range as ₱800 to ₱1,500, or one price when they match", () => {
    expect(formatPriceRange([1500, 800, 1200])).toBe("₱800 to ₱1,500")
    expect(formatPriceRange([800, 800])).toBe("₱800")
    expect(formatPriceRange([])).toBeNull()
  })
})

describe("rowLabels", () => {
  it("keeps the first number's zero padding", () => {
    expect(rowLabels({ prefix: "C", from: "01", to: "03" })).toEqual(["C-01", "C-02", "C-03"])
    expect(rowLabels({ prefix: " ", from: "9", to: "10" })).toEqual(["9", "10"])
  })
})

describe("groupSlots (spec §3.4)", () => {
  const slot = (label: string, section: string | null = null) => ({ label, section })

  it("groups by section, then by the label prefix, keeping list order", () => {
    const groups = groupSlots([slot("A-01", "Main walkway"), slot("C-01"), slot("Photobooth", "Main walkway"), slot("C-02"), slot("12")])

    expect(groups.map((g) => [g.name, g.slots.map((s) => s.label)])).toEqual([
      ["Main walkway", ["A-01", "Photobooth"]],
      ["C", ["C-01", "C-02"]],
      ["Other slots", ["12"]],
    ])
  })
})
