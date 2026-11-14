import { fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { renderWithQuery } from "@/test-utils"
import { CoverCropDialog } from "./cover-crop"

// A 4000 x 3000 photo: the widest 16:9 frame is 4000 x 2250.
const photo = { src: "blob:photo", width: 4000, height: 3000 }

function open(onConfirm = vi.fn(), onCancel = vi.fn()) {
  renderWithQuery(<CoverCropDialog photo={photo} onConfirm={onConfirm} onCancel={onCancel} />)
  return { onConfirm, onCancel }
}

describe("CoverCropDialog", () => {
  it("starts with the widest frame in the middle", async () => {
    const { onConfirm } = open()

    expect(screen.getByRole("dialog", { name: "Frame your cover" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Use this cover" }))

    expect(onConfirm).toHaveBeenCalledWith({ x: 0, y: 375, width: 4000, height: 2250 })
  })

  it("moves the frame with the arrow keys", async () => {
    const { onConfirm } = open()

    const frame = screen.getByRole("group", { name: /Cover framing/ })
    fireEvent.keyDown(frame, { key: "ArrowUp" })
    await userEvent.click(screen.getByRole("button", { name: "Use this cover" }))

    expect(onConfirm.mock.calls[0][0].y).toBeLessThan(375)
  })

  it("zooms in with the button and the slider", async () => {
    const { onConfirm } = open()

    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }))
    await userEvent.click(screen.getByRole("button", { name: "Use this cover" }))

    expect(onConfirm.mock.calls[0][0].width).toBeLessThan(4000)
    expect(screen.getByRole("slider", { name: "Zoom" })).toBeInTheDocument()
  })

  it("cancels", async () => {
    const { onCancel, onConfirm } = open()

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
