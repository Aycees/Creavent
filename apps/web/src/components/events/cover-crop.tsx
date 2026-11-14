"use client"

import type { Crop } from "@creavent/shared"
import { ArrowsOutCardinalIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from "@phosphor-icons/react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { clampFrame, cropFor, maxZoom, moveBy, startFrame, type Frame } from "@/lib/crop"

export type PickedPhoto = { src: string; width: number; height: number }

// The crop step for an event cover: drag the photo (or use the arrow keys) and
// zoom to choose the 16:9 part to keep. Cards and the event page show exactly
// this frame. The original photo is not kept (spec §11.5).
export function CoverCropDialog({ photo, onConfirm, onCancel }: { photo: PickedPhoto; onConfirm: (crop: Crop) => void; onCancel: () => void }) {
  const [frame, setFrame] = React.useState<Frame>(() => startFrame(photo))
  const box = React.useRef<HTMLDivElement>(null)
  const drag = React.useRef<{ x: number; y: number } | null>(null)
  const crop = cropFor(photo, frame)
  const top = maxZoom(photo)
  const step = (top - 1) / 10 || 0.1

  const zoomTo = (zoom: number) => setFrame((f) => clampFrame(photo, { ...f, zoom }))
  const move = (dx: number, dy: number) => setFrame((f) => moveBy(photo, f, { dx, dy, frameWidth: box.current?.clientWidth || 400 }))

  function onKeyDown(e: React.KeyboardEvent) {
    // Each press moves the photo a twentieth of the frame.
    const width = box.current?.clientWidth || 400
    const by = width / 20
    const moves: Record<string, [number, number]> = { ArrowUp: [0, by], ArrowDown: [0, -by], ArrowLeft: [by, 0], ArrowRight: [-by, 0] }
    const m = moves[e.key]
    if (!m) return
    e.preventDefault()
    move(m[0], m[1])
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="md:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Frame your cover</DialogTitle>
          <DialogDescription>Drag the photo and zoom to choose what shows on event cards and the event page.</DialogDescription>
        </DialogHeader>

        <div
          ref={box}
          role="group"
          aria-label="Cover framing. Drag the photo or use the arrow keys to move it."
          tabIndex={0}
          className="relative aspect-video w-full cursor-grab touch-none overflow-hidden rounded-md bg-sunken outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:cursor-grabbing"
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY }
            // Keeps the drag going when the finger leaves the frame. Some
            // browsers refuse it for a pointer they don't track; the drag still works.
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {}
          }}
          onPointerMove={(e) => {
            if (!drag.current) return
            move(e.clientX - drag.current.x, e.clientY - drag.current.y)
            drag.current = { x: e.clientX, y: e.clientY }
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a local photo before upload */}
          <img
            src={photo.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{
              left: `${(-crop.x / crop.width) * 100}%`,
              top: `${(-crop.y / crop.height) * 100}%`,
              width: `${(photo.width / crop.width) * 100}%`,
            }}
          />
          <span className="pointer-events-none absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-sm bg-surface/90 px-2 py-1 text-cap">
            <ArrowsOutCardinalIcon aria-hidden="true" className="size-4" />
            Drag to move
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" aria-label="Zoom out" disabled={frame.zoom <= 1} onClick={() => zoomTo(frame.zoom - step)}>
            <MagnifyingGlassMinusIcon aria-hidden="true" />
          </Button>
          <input
            type="range"
            aria-label="Zoom"
            min={1}
            max={top}
            step={step}
            value={frame.zoom}
            disabled={top <= 1}
            onChange={(e) => zoomTo(Number(e.target.value))}
            className="h-11 flex-1 accent-ink"
          />
          <Button type="button" variant="ghost" size="icon" aria-label="Zoom in" disabled={frame.zoom >= top} onClick={() => zoomTo(frame.zoom + step)}>
            <MagnifyingGlassPlusIcon aria-hidden="true" />
          </Button>
        </div>
        {top <= 1 && <p className="text-cap text-muted">This photo is just big enough, so it can&apos;t be zoomed. You can still move it.</p>}

        <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onConfirm(crop)}>
            Use this cover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
