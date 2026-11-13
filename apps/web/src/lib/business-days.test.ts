import { describe, expect, it } from "vitest"

import { businessDaysSince } from "./business-days"

describe("businessDaysSince", () => {
  it("counts weekdays between two dates in Manila time", () => {
    // Mon Nov 9 to Thu Nov 12, 2026
    expect(businessDaysSince("2026-11-09T02:00:00Z", new Date("2026-11-12T02:00:00Z"))).toBe(3)
  })

  it("skips the weekend", () => {
    // Fri Nov 13 to Mon Nov 16
    expect(businessDaysSince("2026-11-13T02:00:00Z", new Date("2026-11-16T02:00:00Z"))).toBe(1)
  })

  it("is 0 on the same day", () => {
    expect(businessDaysSince("2026-11-13T01:00:00Z", new Date("2026-11-13T09:00:00Z"))).toBe(0)
  })
})
