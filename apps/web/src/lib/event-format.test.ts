import { describe, expect, it } from "vitest"

import { formatSchedule, formatTime } from "./event-format"

describe("formatSchedule (spec §3.1.1)", () => {
  it("shows one day with its hours", () => {
    expect(formatSchedule({ startDate: "2027-01-16", endDate: "2027-01-16", opensAt: "17:00", closesAt: "23:00" })).toBe(
      "Sat, Jan 16 · 5 PM to 11 PM"
    )
  })

  it("shows several days with daily hours", () => {
    expect(formatSchedule({ startDate: "2027-01-15", endDate: "2027-01-17", opensAt: "16:00", closesAt: "22:00" })).toBe(
      "Fri, Jan 15 to Sun, Jan 17 · 4 PM to 10 PM daily"
    )
  })

  it("is null until the dates and times are set", () => {
    expect(formatSchedule({ startDate: "2027-01-15", endDate: null, opensAt: "16:00", closesAt: "22:00" })).toBeNull()
  })
})

describe("formatTime", () => {
  it("drops the minutes on the hour and keeps them otherwise", () => {
    expect(formatTime("09:00")).toBe("9 AM")
    expect(formatTime("12:30")).toBe("12:30 PM")
    expect(formatTime("00:15")).toBe("12:15 AM")
  })
})
