import { describe, expect, it } from "vitest"

import { cropFor, maxZoom, moveBy } from "./crop"

// A 4000 x 3000 photo: the widest 16:9 frame is 4000 x 2250.
const photo = { width: 4000, height: 3000 }

describe("cropFor", () => {
  it("starts with the widest 16:9 frame in the middle", () => {
    expect(cropFor(photo, { zoom: 1, cx: 2000, cy: 1500 })).toEqual({ x: 0, y: 375, width: 4000, height: 2250 })
  })

  it("zooms in around the center", () => {
    expect(cropFor(photo, { zoom: 2, cx: 2000, cy: 1500 })).toEqual({ x: 1000, y: 938, width: 2000, height: 1125 })
  })

  it("keeps the frame inside the photo", () => {
    expect(cropFor(photo, { zoom: 2, cx: 3900, cy: 50 })).toEqual({ x: 2000, y: 0, width: 2000, height: 1125 })
  })

  it("uses the full height of a wide photo", () => {
    expect(cropFor({ width: 4000, height: 1500 }, { zoom: 1, cx: 2000, cy: 750 })).toEqual({ x: 667, y: 0, width: 2667, height: 1500 })
  })
})

describe("maxZoom", () => {
  it("stops where the frame would be smaller than 1280 x 720", () => {
    expect(maxZoom(photo)).toBeCloseTo(4000 / 1280)
    expect(maxZoom({ width: 1280, height: 720 })).toBe(1)
    expect(maxZoom({ width: 10000, height: 6000 })).toBe(4)
  })
})

describe("moveBy", () => {
  it("drags the photo, so the frame moves the other way, in photo pixels", () => {
    // The frame is shown 400 px wide, and shows 4000 photo px: 1 screen px is 10.
    expect(moveBy(photo, { zoom: 1, cx: 2000, cy: 1500 }, { dx: 0, dy: 20, frameWidth: 400 })).toEqual({ zoom: 1, cx: 2000, cy: 1300 })
  })

  it("stops at the edge of the photo", () => {
    expect(moveBy(photo, { zoom: 1, cx: 2000, cy: 1500 }, { dx: 0, dy: 1000, frameWidth: 400 })).toEqual({ zoom: 1, cx: 2000, cy: 1125 })
  })
})
