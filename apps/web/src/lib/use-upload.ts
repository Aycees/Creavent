"use client"

import { imageMimeTypes, uploadRules, type Crop, type UploadPurpose, type UploadedFile } from "@creavent/shared"
import * as React from "react"

import { api } from "./api"

type ErrorBody = { message?: string } | undefined

// Uploads one image the way spec §11.3 describes: Ask the API, PUT the file
// straight to storage, then Complete. The browser checks type and size first
// so mistakes show early; the API checks again.
export function useUpload(purpose: UploadPurpose) {
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // `crop` is the frame chosen in the cover crop step (event covers only).
  async function upload(file: File, options: { crop?: Crop } = {}): Promise<UploadedFile | null> {
    setError(null)
    const rules = uploadRules[purpose]
    if (!(imageMimeTypes as readonly string[]).includes(file.type)) {
      setError("Use a JPEG, PNG, or WebP photo")
      return null
    }
    if (file.size > rules.maxBytes) {
      setError(`This file is over ${rules.maxBytes / (1024 * 1024)} MB`)
      return null
    }
    setPending(true)
    try {
      const ask = await api.POST("/api/files", {
        body: { purpose, mimeType: file.type as (typeof imageMimeTypes)[number], sizeBytes: file.size },
      })
      if (!ask.data) {
        setError((ask.error as ErrorBody)?.message ?? "Upload failed. Try again.")
        return null
      }
      const put = await fetch(ask.data.uploadUrl, { method: "PUT", headers: ask.data.headers, body: file })
      if (!put.ok) {
        setError("Upload failed. Try again.")
        return null
      }
      const done = await api.POST("/api/files/{id}/complete", {
        params: { path: { id: ask.data.fileId } },
        body: options.crop ? { crop: options.crop } : {},
      })
      if (!done.data) {
        setError((done.error as ErrorBody)?.message ?? "Upload failed. Try again.")
        return null
      }
      return done.data
    } catch {
      setError("Upload failed. Check your connection and try again.")
      return null
    } finally {
      setPending(false)
    }
  }

  return { upload, pending, error }
}
