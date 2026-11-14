import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  uploadRules,
  type AskUploadInput,
  type UploadPurpose,
  type UploadedFile,
} from '@creavent/shared';
import { fileTypeFromBuffer } from 'file-type';
import type { File } from '../generated/prisma/client.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import {
  processImage,
  UploadRejected,
  withImageSlot,
} from './process-image.js';
import { STORAGE, type ObjectStorage } from './storage.js';

const MAX_PENDING = 20;
const incomingKey = (id: string) => `incoming/${id}`;

// The upload flow of spec §11.3: Ask, Upload (browser to R2), Complete, Attach.
@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async ask(userId: string, input: AskUploadInput) {
    const rules = uploadRules[input.purpose];
    if (input.sizeBytes > rules.maxBytes) {
      throw new BadRequestException(
        `This file is over ${rules.maxBytes / (1024 * 1024)} MB`,
      );
    }
    const pending = await this.prisma.file.count({
      where: { uploadedBy: userId, status: 'pending' },
    });
    if (pending >= MAX_PENDING) {
      throw new HttpException(
        'Too many uploads in progress. Finish or cancel some first.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const id = crypto.randomUUID();
    await this.prisma.file.create({
      data: {
        id,
        uploadedBy: userId,
        purpose: input.purpose,
        storageKey: `${input.purpose}/${id}.webp`,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });
    const signed = await this.storage.presignPut(
      'private',
      incomingKey(id),
      input.mimeType,
      input.sizeBytes,
    );
    return { fileId: id, uploadUrl: signed.url, headers: signed.headers };
  }

  async complete(userId: string, fileId: string): Promise<UploadedFile> {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, uploadedBy: userId, status: 'pending' },
    });
    if (!file) throw new NotFoundException('Upload not found');
    const purpose = file.purpose as UploadPurpose;

    try {
      return await withImageSlot(() => this.finish(file, purpose));
    } catch (error) {
      if (!(error instanceof UploadRejected)) throw error;
      await this.storage.delete('private', incomingKey(file.id));
      await this.prisma.file.delete({ where: { id: file.id } });
      throw new BadRequestException(error.message);
    }
  }

  // Download, check, process, and store one upload. Runs in an image slot.
  private async finish(
    file: File,
    purpose: UploadPurpose,
  ): Promise<UploadedFile> {
    const rules = uploadRules[purpose];
    const body = await this.storage.get('private', incomingKey(file.id));
    if (!body) throw new UploadRejected("We didn't get the file. Try again.");
    if (body.length > rules.maxBytes) {
      throw new UploadRejected(
        `This file is over ${rules.maxBytes / (1024 * 1024)} MB`,
      );
    }
    // The real type, from the file's first bytes. Extensions are ignored.
    const real = await fileTypeFromBuffer(body);
    if (
      !real ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(real.mime)
    ) {
      throw new UploadRejected('Use a JPEG, PNG, or WebP photo');
    }
    if (real.mime !== file.mimeType)
      throw new UploadRejected("This file isn't the type it claims to be");

    const image = await processImage(
      body,
      purpose,
      rules.minWidth,
      rules.minHeight,
    );
    await this.storage.put('public', file.storageKey, image.body, 'image/webp');
    await this.storage.delete('private', incomingKey(file.id));
    const ready = await this.prisma.file.update({
      where: { id: file.id },
      data: {
        status: 'ready',
        mimeType: 'image/webp',
        sizeBytes: image.body.length,
        width: image.width,
        height: image.height,
      },
    });
    return this.toUploadedFile(ready);
  }

  toUploadedFile(file: File): UploadedFile {
    return {
      id: file.id,
      purpose: file.purpose as UploadPurpose,
      url: this.storage.publicUrl(file.storageKey),
      width: file.width,
      height: file.height,
    };
  }

  url(storageKey: string) {
    return this.storage.publicUrl(storageKey);
  }
}

// A file is attached only when it is ready, matches the place, and belongs to
// the person attaching it (data model §6.10).
export async function assertAttachable(
  tx: Tx,
  fileId: string,
  userId: string,
  purpose: UploadPurpose,
) {
  const file = await tx.file.findUnique({ where: { id: fileId } });
  if (
    !file ||
    file.uploadedBy !== userId ||
    file.status !== 'ready' ||
    file.purpose !== purpose ||
    file.deletedAt
  ) {
    throw new BadRequestException('This file cannot be used here');
  }
  return file;
}
