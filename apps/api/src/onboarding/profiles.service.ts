import { ConflictException, Injectable } from '@nestjs/common';
import type { organizerProfileUpdateSchema, vendorProfileUpdateSchema } from '@creavent/shared';
import type { z } from 'zod';
import { lockOrganizer, needsReReview } from '../approvals/approval-status.js';
import { assertAttachable } from '../files/files.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OnboardingService } from './onboarding.service.js';
import { slugAvailable } from './slugs.js';

const TAKEN = 'This link is taken. Try another.';

// The profile edit pages (mockup VendorProfileEdit, OrgProfileEdit). Each
// saves the whole profile at once and answers with the same state as
// onboarding.
@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
  ) {}

  async slugAvailable(userId: string, kind: 'vendor' | 'organizer', slug: string) {
    return { available: await slugAvailable(this.prisma, kind, slug, userId) };
  }

  async updateVendor(userId: string, input: z.output<typeof vendorProfileUpdateSchema>) {
    await this.prisma.$transaction(async (tx) => {
      await this.onboarding.requireRole(tx, userId, 'vendor');
      if (!(await slugAvailable(tx, 'vendor', input.slug, userId))) throw new ConflictException(TAKEN);
      const active = await tx.category.count({ where: { id: { in: input.categoryIds }, isActive: true } });
      if (active !== new Set(input.categoryIds).size) throw new ConflictException('Pick categories from the list');
      if (input.avatarFileId) await assertAttachable(tx, input.avatarFileId, userId, 'avatar');
      const photoIds = [...new Set(input.photoFileIds)];
      for (const id of photoIds) await assertAttachable(tx, id, userId, 'vendor_photo');

      const data = {
        shopName: input.shopName,
        slug: input.slug,
        description: input.description ?? null,
        products: input.products ?? null,
        socialLinks: input.socialLinks,
      };
      const profile = await tx.vendorProfile.upsert({ where: { userId }, update: data, create: { ...data, userId } });
      await tx.user.update({ where: { id: userId }, data: { avatarFileId: input.avatarFileId } });
      await tx.vendorProfileCategory.deleteMany({ where: { vendorProfileId: profile.id } });
      await tx.vendorProfileCategory.createMany({
        data: [...new Set(input.categoryIds)].map((categoryId) => ({ vendorProfileId: profile.id, categoryId })),
      });
      await tx.vendorProfilePhoto.deleteMany({ where: { vendorProfileId: profile.id } });
      await tx.vendorProfilePhoto.createMany({
        data: photoIds.map((fileId, sortOrder) => ({ vendorProfileId: profile.id, fileId, sortOrder })),
      });
    });
    return this.onboarding.state(userId);
  }

  async updateOrganizer(userId: string, input: z.output<typeof organizerProfileUpdateSchema>) {
    await this.prisma.$transaction(async (tx) => {
      await lockOrganizer(tx, userId);
      const role = await this.onboarding.requireRole(tx, userId, 'organizer');
      if (!(await slugAvailable(tx, 'organizer', input.slug, userId))) throw new ConflictException(TAKEN);
      if (input.logoFileId) await assertAttachable(tx, input.logoFileId, userId, 'organizer_logo');
      const current = await tx.organizerProfile.findUnique({ where: { userId } });

      const data = {
        displayName: input.displayName,
        slug: input.slug,
        logoFileId: input.logoFileId,
        city: input.city ?? null,
        about: input.about ?? null,
        socialLinks: input.socialLinks,
      };
      await tx.organizerProfile.upsert({ where: { userId }, update: data, create: { ...data, userId } });

      const reReview =
        current !== null &&
        needsReReview(
          role.approvalStatus,
          { displayName: current.displayName, reviewedLinks: (role.reviewedLinks ?? []) as string[] },
          input,
        );
      await tx.userRole.update({
        where: { id: role.id },
        data: {
          contactEmail: input.contactEmail,
          ...(reReview ? { approvalStatus: 'pending_review' as const, approvalSubmittedAt: new Date() } : {}),
        },
      });
    });
    return this.onboarding.state(userId);
  }
}
