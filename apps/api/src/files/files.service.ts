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
  type Crop,
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
  event_cover: 'organizer',
  payment_qr: 'organizer',
  vendor_floor_plan: 'organizer',
  public_floor_plan: 'organizer',
  application_document: 'vendor',
  payment_proof: 'vendor',
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
    const isPdf = input.mimeType === 'application/pdf';
    if (isPdf && !rules.pdf) throw new BadRequestException('Use a JPEG, PNG, or WebP photo');
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
        storageKey: `${input.purpose}/${id}.${isPdf ? 'pdf' : 'webp'}`,
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

  async complete(userId: string, fileId: string, crop?: Crop): Promise<UploadedFile> {
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
    if (crop && purpose !== 'event_cover') throw new BadRequestException('Only event covers can be framed');

    try {
      return await withImageSlot(() => this.finish(file, purpose, crop));
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
    crop?: Crop,
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
    if (file.mimeType === 'application/pdf' || real?.mime === 'application/pdf') {
      return this.finishPdf(file, body, real?.mime);
    }
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
      crop,
    );
    await this.storage.put(rules.private ? 'private' : 'public', file.storageKey, image.body, 'image/webp');
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

  // PDFs are checked for the signature and stored as uploaded, never
  // rewritten (spec §11.4). They are only allowed in private purposes.
  private async finishPdf(file: File, body: Buffer, realMime: string | undefined): Promise<UploadedFile> {
    if (file.mimeType !== 'application/pdf' || realMime !== 'application/pdf' || !body.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new UploadRejected("This file isn't the type it claims to be");
    }
    await this.storage.put('private', file.storageKey, body, 'application/pdf');
    await this.storage.delete('private', incomingKey(file.id));
    const ready = await this.prisma.file.update({
      where: { id: file.id },
      data: { status: 'ready', sizeBytes: body.length },
    });
    return this.toUploadedFile(ready);
  }

  toUploadedFile(file: File): UploadedFile {
    return {
      id: file.id,
      purpose: file.purpose as UploadPurpose,
      url: this.fileUrl(file),
      width: file.width,
      height: file.height,
    };
  }

  url(storageKey: string) {
    return this.storage.publicUrl(storageKey);
  }

  // Where the app shows a file: the public address, or the API's private
  // file route, which checks who is asking (spec §11.6).
  fileUrl(file: Pick<File, 'id' | 'purpose' | 'storageKey'>) {
    return uploadRules[file.purpose as UploadPurpose]?.private ? `/api/files/${file.id}` : this.storage.publicUrl(file.storageKey);
  }

  // A 5-minute address for a private file, for someone allowed to open it
  // (data model §6.6). Anyone else gets Not found, so ids can't be probed.
  async privateUrl(user: { id: string; isAdmin: boolean }, fileId: string) {
    const file = await this.prisma.file.findFirst({ where: { id: fileId, status: 'ready', deletedAt: null } });
    if (!file || !uploadRules[file.purpose as UploadPurpose]?.private || !(await this.canOpen(user, file))) {
      throw new NotFoundException('File not found');
    }
    // Each admin view of someone's application document or proof of payment
    // is saved in the audit log (spec §2, decision D8).
    if (user.isAdmin && file.uploadedBy !== user.id && (file.purpose === 'application_document' || file.purpose === 'payment_proof')) {
      // The event and shop are copied in, so the view stays in the event's
      // history after the retention job deletes the file (flow 11).
      const owner =
        file.purpose === 'payment_proof'
          ? await this.prisma.paymentProof.findFirst({ where: { fileId: file.id }, select: { eventId: true, vendorProfile: { select: { shopName: true } } } })
          : await this.prisma.applicationDocument
              .findFirst({ where: { fileId: file.id }, select: { application: { select: { eventId: true, vendorProfile: { select: { shopName: true } } } } } })
              .then((d) => d?.application ?? null);
      await this.prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: `${file.purpose}.view`,
          entityType: 'file',
          entityId: file.id,
          changes: owner ? { eventId: owner.eventId, shopName: owner.vendorProfile.shopName } : undefined,
        },
      });
    }
    // PDFs always download, named from the purpose and date (spec §11.6).
    const download =
      file.mimeType === 'application/pdf'
        ? `${file.purpose.replaceAll('_', '-')}-${file.createdAt.toISOString().slice(0, 10)}.pdf`
        : undefined;
    return this.storage.presignGet(file.storageKey, download);
  }

  private async canOpen(user: { id: string; isAdmin: boolean }, file: File) {
    if (user.isAdmin || file.uploadedBy === user.id) return true;
    if (file.purpose === 'payment_qr') {
      // The event's organizer, and vendors with an active assignment whose
      // copied payment details show this QR (the one they were told to pay to,
      // even if the organizer replaced it later).
      const method = await this.prisma.eventPaymentMethod.findFirst({
        where: { qrFileId: file.id, event: { organizerProfile: { userId: user.id } } },
      });
      if (method) return true;
      const assignments = await this.prisma.slotAssignment.findMany({
        where: { status: { in: ['assigned', 'reserved'] }, vendorProfile: { userId: user.id } },
        select: { paymentInstructionsSnapshot: true },
      });
      return assignments.some((a) => ((a.paymentInstructionsSnapshot ?? []) as { qrFileId?: string | null }[]).some((i) => i.qrFileId === file.id));
    }
    if (file.purpose === 'payment_proof') {
      // The organizer of the event the proof was sent for (data model §6.6).
      const proof = await this.prisma.paymentProof.findFirst({
        where: { fileId: file.id, event: { organizerProfile: { userId: user.id } } },
      });
      return proof !== null;
    }
    if (file.purpose === 'application_document') {
      // The organizer of the event the vendor applied to (data model §6.6).
      const doc = await this.prisma.applicationDocument.findFirst({
        where: { fileId: file.id, application: { event: { organizerProfile: { userId: user.id } } } },
      });
      return doc !== null;
    }
    return false;
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
