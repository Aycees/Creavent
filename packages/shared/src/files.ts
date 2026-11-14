import { z } from 'zod';

// Upload rules (spec §11.1). Each feature adds its purposes when it is built.
export const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const uploadPurposeSchema = z.enum(['avatar', 'vendor_photo', 'organizer_logo', 'event_cover']);
export type UploadPurpose = z.infer<typeof uploadPurposeSchema>;

const MB = 1024 * 1024;

export const uploadRules: Record<
  UploadPurpose,
  { maxBytes: number; minWidth?: number; minHeight?: number; label: string }
> = {
  avatar: { maxBytes: 5 * MB, minWidth: 256, minHeight: 256, label: 'Avatar' },
  organizer_logo: { maxBytes: 5 * MB, minWidth: 256, minHeight: 256, label: 'Logo' },
  vendor_photo: { maxBytes: 10 * MB, label: 'Photo' },
  event_cover: { maxBytes: 10 * MB, minWidth: 1280, minHeight: 720, label: 'Cover' },
};

// Step 1, Ask: what the browser is about to upload.
export const askUploadSchema = z.object({
  purpose: uploadPurposeSchema,
  mimeType: z.enum(imageMimeTypes, 'Use a JPEG, PNG, or WebP photo'),
  sizeBytes: z.number().int().positive(),
});
export type AskUploadInput = z.infer<typeof askUploadSchema>;

export const askUploadResponseSchema = z.object({
  fileId: z.uuid(),
  // A signed address that accepts one PUT of the declared type and size, for
  // 5 minutes.
  uploadUrl: z.string(),
  headers: z.record(z.string(), z.string()),
});
export type AskUploadResponse = z.infer<typeof askUploadResponseSchema>;

export const uploadedFileSchema = z.object({
  id: z.uuid(),
  purpose: uploadPurposeSchema,
  url: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
});
export type UploadedFile = z.infer<typeof uploadedFileSchema>;
