"use client"

// Opens a picked photo in the browser to learn its upright size (browsers turn
// phone photos upright, as the API does) before the crop step.
export function readPhoto(file: File): Promise<{ src: string; width: number; height: number } | null> {
  const src = URL.createObjectURL(file)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ src, width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => {
      URL.revokeObjectURL(src)
      resolve(null)
    }
    img.src = src
  })
}
