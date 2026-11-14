import {
  BadRequestException,
  ForbiddenException,
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
// Upload requests per user per hour (spec §11.3).
const MAX_PER_HOUR = 30;
const MAX_VENDOR_PHOTOS = 8;

const needsRole: Partial<Record<UploadPurpose, 'vendor' | 'organizer'>> = {
  organizer_logo: 'organizer',
  vendor_photo: 'vendor',
};
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
    // Who may upload what (spec §11.3): a logo needs the organizer role,
    // product photos the vendor role. Avatars are for anyone.
    const role = needsRole[input.purpose];
    if (role) {
      const has = await this.prisma.userRole.findUnique({
        where: { userId_role: { userId, role } },
      });
      if (!has || has.suspendedAt) {
        throw new ForbiddenException(`Add the ${role} role to upload this`);
      }
    }
    if (input.purpose === 'vendor_photo') {
      const photos = await this.prisma.vendorProfilePhoto.count({
        where: { vendorProfile: { userId } },
      });
      if (photos >= MAX_VENDOR_PHOTOS) {
        throw new BadRequestException(
          `You have ${MAX_VENDOR_PHOTOS} photos already. Remove one to add another.`,
        );
      }
    }
    const lastHour = await this.prisma.file.count({
      where: {
        uploadedBy: userId,
        createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (lastHour >= MAX_PER_HOUR) {
      throw new HttpException(
        'You uploaded a lot in the last hour. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const pending = await this.prisma.file.count({
      where: { uploadedBy: userId, status: 'pending', deletedAt: null },
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
      where: {
        id: fileId,
        uploadedBy: userId,
        status: 'pending',
        deletedAt: null,
      },
    });
    if (!file) throw new NotFoundException('Upload not found');
    const purpose = file.purpose as UploadPurpose;

    try {
      return await withImageSlot(() => this.finish(file, purpose));
    } catch (error) {
      if (!(error instanceof UploadRejected)) throw error;
      await this.storage.delete('private', incomingKey(file.id));
      // Kept and marked deleted rather than removed, so failed uploads still
      // count toward the hourly limit. The cleanup job removes the row later.
      await this.prisma.file.update({
        where: { id: file.id },
        data: { deletedAt: new Date() },
      });
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

// Files no longer used after a change: a replaced picture or a removed photo
// (spec §11.7). They are marked deleted, and the cleanup job removes them
// from storage (data model §5.2).
export async function retireFiles(
  tx: Tx,
  before: (string | null | undefined)[],
  after: (string | null | undefined)[],
) {
  const kept = new Set(after.filter(Boolean));
  const gone = before.filter(
    (id): id is string => Boolean(id) && !kept.has(id!),
  );
  if (gone.length === 0) return;
  await tx.file.updateMany({
    where: { id: { in: gone }, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}
