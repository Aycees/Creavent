import type { Crop } from "@creavent/shared"

// Framing a 16:9 event cover (spec §11.5). The state is a zoom and the frame's
// center in the photo's own pixels, so it never depends on the screen size.
export type Size = { width: number; height: number }
export type Frame = { zoom: number; cx: number; cy: number }

const MIN_WIDTH = 1280
const MAX_ZOOM = 4

// The widest 16:9 frame that fits the photo (zoom 1).
function widest(photo: Size) {
  return Math.min(photo.width, Math.round((photo.height * 16) / 9))
}

function frameSize(photo: Size, zoom: number) {
  const width = Math.round(widest(photo) / zoom)
  return { width, height: Math.round((width * 9) / 16) }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// Zoom in until the frame would keep less than 1280 px of the photo, or 4x.
export function maxZoom(photo: Size) {
  return clamp(widest(photo) / MIN_WIDTH, 1, MAX_ZOOM)
}

export function startFrame(photo: Size): Frame {
  return { zoom: 1, cx: photo.width / 2, cy: photo.height / 2 }
}

// The part of the photo to keep, kept inside the photo.
export function cropFor(photo: Size, frame: Frame): Crop {
  const { width, height } = frameSize(photo, frame.zoom)
  return {
    x: clamp(Math.round(frame.cx - width / 2), 0, photo.width - width),
    y: clamp(Math.round(frame.cy - height / 2), 0, photo.height - height),
    width,
    height,
  }
}

// Keeps the frame's center where the whole frame stays inside the photo.
export function clampFrame(photo: Size, frame: Frame): Frame {
  const zoom = clamp(frame.zoom, 1, maxZoom(photo))
  const { width, height } = frameSize(photo, zoom)
  return {
    zoom,
    cx: clamp(frame.cx, width / 2, photo.width - width / 2),
    cy: clamp(frame.cy, height / 2, photo.height - height / 2),
  }
}

// Dragging the photo by (dx, dy) screen px moves the frame the other way.
export function moveBy(photo: Size, frame: Frame, drag: { dx: number; dy: number; frameWidth: number }): Frame {
  const perPixel = frameSize(photo, frame.zoom).width / drag.frameWidth
  return clampFrame(photo, { ...frame, cx: frame.cx - drag.dx * perPixel, cy: frame.cy - drag.dy * perPixel })
}
