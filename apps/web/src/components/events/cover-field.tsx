"use client"

import { ImageIcon, UploadSimpleIcon } from "@phosphor-icons/react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { readPhoto } from "@/lib/read-photo"
import { useUpload } from "@/lib/use-upload"
import { CoverCropDialog, type PickedPhoto } from "./cover-crop"

// The event cover: pick a photo, frame its 16:9 part, upload it (spec
// §11.5). Used by event setup and the pop-up form.
export function CoverField({
  url,
  alt,
  disabled,
  onUploaded,
  onRemove,
}: {
  url: string | null
  alt: string
  disabled?: boolean
  onUploaded: (file: { id: string; url: string }) => void
  onRemove: () => void
}) {
  const coverUpload = useUpload("event_cover")
  const coverInput = React.useRef<HTMLInputElement>(null)
  // The picked photo, while it is framed.
  const [picked, setPicked] = React.useState<{ file: File; photo: PickedPhoto } | null>(null)
  const [pickError, setPickError] = React.useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label">Cover image</span>
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="grid aspect-video w-full flex-none place-items-center overflow-hidden rounded-md border border-border bg-sunken text-muted md:w-48">
          {/* eslint-disable-next-line @next/next/no-img-element -- R2 addresses, already sized */}
          {url ? <img src={url} alt={alt} className="size-full object-cover" /> : <ImageIcon aria-hidden="true" className="size-6" />}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-help text-muted">At least 1280 × 720 px, up to 10 MB. JPEG, PNG or WebP. You choose the 16:9 part to show. To reframe it later, upload the photo again.</p>
          {!disabled && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={coverUpload.pending} onClick={() => coverInput.current?.click()}>
                <UploadSimpleIcon aria-hidden="true" className="size-4" />
                {coverUpload.pending ? "Uploading…" : url ? "Replace" : "Upload cover"}
              </Button>
              {url && (
                <Button type="button" variant="danger-ghost" onClick={onRemove}>
                  Remove
                </Button>
              )}
            </div>
          )}
          {(pickError ?? coverUpload.error) && <p className="text-help text-danger-ink">{pickError ?? coverUpload.error}</p>}
        </div>
        <input
          ref={coverInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Cover image file"
          className="sr-only"
          tabIndex={-1}
          disabled={disabled}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file) return
            setPickError(null)
            const photo = await readPhoto(file)
            if (!photo) return setPickError("This file isn't a photo we can open")
            if (photo.width < 1280 || photo.height < 720) {
              URL.revokeObjectURL(photo.src)
              return setPickError("This photo is too small. Use at least 1280 x 720")
            }
            setPicked({ file, photo })
          }}
        />
      </div>
      {picked && (
        <CoverCropDialog
          photo={picked.photo}
          onCancel={() => {
            URL.revokeObjectURL(picked.photo.src)
            setPicked(null)
          }}
          onConfirm={async (crop) => {
            const { file, photo } = picked
            setPicked(null)
            const done = await coverUpload.upload(file, { crop })
            URL.revokeObjectURL(photo.src)
            if (done) onUploaded({ id: done.id, url: done.url })
          }}
        />
      )}
    </div>
  )
}
