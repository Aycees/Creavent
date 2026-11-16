import { Logger } from '@nestjs/common';
import { uploadRules, type UploadPurpose } from '@creavent/shared';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { ObjectStorage } from '../files/storage.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const HOURS_24 = 24 * 3_600_000;

// The daily cleanup (spec §11.7, data model §8): files removed more than 24
// hours ago lose their object and then their row, and uploads that never
// reached Complete are deleted after 24 hours. A removed file that a page
// still points to is kept: its foreign keys would quietly empty the picture.
// Each file goes in its own transaction, so a failure keeps the row and its
// object, and the run moves on.
export async function cleanUpFiles(prisma: PrismaClient | PrismaService, storage: ObjectStorage, now = new Date()) {
  const before = new Date(now.getTime() - HOURS_24);
  const logger = new Logger('CleanUpFiles');
  const result = { deleted: 0, abandoned: 0, kept: 0 };

  const unused = {
    avatarOf: { none: {} },
    logoOf: { none: {} },
    qrOf: { none: {} },
    coverOf: { none: {} },
    vendorFloorPlanOf: { none: {} },
    publicFloorPlanOf: { none: {} },
    vendorPhotos: { none: {} },
    applicationDocuments: { none: {} },
    paymentProofs: { none: {} },
  };
  const removed = await prisma.file.findMany({ where: { deletedAt: { lt: before }, ...unused }, select: { id: true, purpose: true, storageKey: true, status: true } });
  result.kept += await prisma.file.count({ where: { deletedAt: { lt: before }, NOT: unused } });
  const abandoned = await prisma.file.findMany({ where: { status: 'pending', deletedAt: null, createdAt: { lt: before } }, select: { id: true } });

  for (const f of removed) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.file.delete({ where: { id: f.id } });
        if (f.status === 'pending') await storage.delete('private', `incoming/${f.id}`);
        else await storage.delete(uploadRules[f.purpose as UploadPurpose]?.private ? 'private' : 'public', f.storageKey);
      });
      result.deleted += 1;
    } catch (error) {
      result.kept += 1;
      logger.warn(`Kept file ${f.id}: ${(error as Error).message}`);
    }
  }
  for (const f of abandoned) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.file.delete({ where: { id: f.id } });
        await storage.delete('private', `incoming/${f.id}`);
      });
      result.abandoned += 1;
    } catch (error) {
      result.kept += 1;
      logger.warn(`Kept upload ${f.id}: ${(error as Error).message}`);
    }
  }
  return result;
}
