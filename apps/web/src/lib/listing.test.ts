import { describe, expect, it } from "vitest"

import { groupByWeekend, monthDays, nextMonthName } from "./listing"

const ev = (name: string, startDate: string, endDate = startDate) => ({ name, startDate, endDate })

// Spec §7.3: This weekend, Next weekend, and Later. A multi-day event goes
// under a weekend when any of its days is that Saturday or Sunday.
describe("groupByWeekend", () => {
  it("groups from a Thursday", () => {
    const groups = groupByWeekend(
      [ev("Sat", "2026-11-14"), ev("Fri to Sun", "2026-11-20", "2026-11-22"), ev("Mon", "2026-11-16"), ev("Later", "2026-12-05")],
      "2026-11-12"
    )

    expect(groups.map((g) => [g.key, g.from, g.to, g.events.map((e) => e.name)])).toEqual([
      ["this", "2026-11-14", "2026-11-15", ["Sat"]],
      ["next", "2026-11-21", "2026-11-22", ["Fri to Sun"]],
      ["later", null, null, ["Mon", "Later"]],
    ])
  })

  it("counts today's Sunday as this weekend", () => {
    const groups = groupByWeekend([ev("Sun", "2026-11-15"), ev("Next Sat", "2026-11-21")], "2026-11-15")

    expect(groups.map((g) => [g.key, g.from, g.events.map((e) => e.name)])).toEqual([
      ["this", "2026-11-14", ["Sun"]],
      ["next", "2026-11-21", ["Next Sat"]],
    ])
  })

  it("leaves out empty groups", () => {
    expect(groupByWeekend([ev("Later", "2026-12-05")], "2026-11-12").map((g) => g.key)).toEqual(["later"])
  })
})

describe("monthDays", () => {
  it("fills whole weeks from Sunday, marking days outside the month", () => {
    const days = monthDays("2026-11")

    expect(days).toHaveLength(35)
    expect(days[0]).toEqual({ date: "2026-11-01", inMonth: true })
    expect(days[29]).toEqual({ date: "2026-11-30", inMonth: true })
    expect(days[30]).toEqual({ date: "2026-12-01", inMonth: false })
  })

  it("starts before the 1st when the month doesn't begin on a Sunday", () => {
    const days = monthDays("2026-12")

    expect(days[0]).toEqual({ date: "2026-11-29", inMonth: false })
    expect(days[2]).toEqual({ date: "2026-12-01", inMonth: true })
  })
})

describe("nextMonthName", () => {
  it("names the month after today's", () => {
    expect(nextMonthName("2026-11-16")).toBe("December")
    expect(nextMonthName("2026-12-31")).toBe("January")
  })
})
