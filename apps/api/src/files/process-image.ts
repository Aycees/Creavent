import type { UploadPurpose } from '@creavent/shared';
import sharp, { type Metadata, type ResizeOptions } from 'sharp';

// A guard against files built to exhaust memory (spec §11.4).
const MAX_PIXELS = 50_000_000;

export class UploadRejected extends Error {}

// How each purpose is stored (spec §11.5).
const resize: Record<UploadPurpose, ResizeOptions> = {
  avatar: { width: 256, height: 256, fit: 'cover', position: 'centre', withoutEnlargement: true },
  organizer_logo: { width: 512, height: 512, fit: 'inside', withoutEnlargement: true },
  vendor_photo: { width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true },
  event_cover: { width: 1600, height: 900, fit: 'cover', position: 'centre', withoutEnlargement: true },
};

// Event covers are cropped to 16:9 from the center, at most 1600 x 900, and
// never enlarged (spec §11.5).
function coverSize(width: number, height: number): ResizeOptions {
  const cropWidth = Math.min(width, Math.round((height * 16) / 9));
  const outWidth = Math.min(1600, cropWidth);
  return { width: outWidth, height: Math.round((outWidth * 9) / 16), fit: 'cover', position: 'centre' };
}

// Only so many images are processed at once, so a busy moment can't run the
// API out of memory (spec §11.5).
// A slot freed by finished work goes straight to the next waiter, so new work
// can't slip in between and go over the limit.
export function createLimiter(max: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async function limit<T>(work: () => Promise<T>): Promise<T> {
    if (running < max) running += 1;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      return await work();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else running -= 1;
    }
  };
}

// Shared by the whole Complete step, download included, so a burst of
// uploads can't pull many large files into memory at once.
export const withImageSlot = createLimiter(2);

// Decodes the upload, checks its size, rotates it upright, resizes it for its
// purpose, and re-encodes it as WebP. Re-encoding drops all metadata,
// including a phone photo's GPS location.
// Call inside withImageSlot.
export function processImage(input: Buffer, purpose: UploadPurpose, minWidth?: number, minHeight?: number) {
  return (async () => {
    let meta: Metadata;
    try {
      meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
    } catch {
      throw new UploadRejected("This file isn't a photo we can open");
    }
    if ((meta.pages ?? 1) > 1) throw new UploadRejected('Animated images are not accepted');
    const upright = (meta.orientation ?? 1) >= 5;
    const width = (upright ? meta.height : meta.width) ?? 0;
    const height = (upright ? meta.width : meta.height) ?? 0;
    if ((minWidth && width < minWidth) || (minHeight && height < minHeight)) {
      throw new UploadRejected(`This photo is too small. Use at least ${minWidth} x ${minHeight}`);
    }
    const { data, info } = await sharp(input, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize(purpose === 'event_cover' ? coverSize(width, height) : resize[purpose])
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { body: data, width: info.width, height: info.height };
  })();
}
