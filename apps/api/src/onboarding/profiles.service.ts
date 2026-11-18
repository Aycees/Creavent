import { ConflictException, Injectable } from '@nestjs/common';
import type { organizerProfileUpdateSchema, vendorProfileUpdateSchema } from '@creavent/shared';
import type { z } from 'zod';
import { changeApprovalStatus, lockOrganizer, lockVendor, needsReReview } from '../approvals/approval-status.js';
import { assertAttachable, retireFiles } from '../files/files.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublicRefreshService } from '../public/public-refresh.service.js';
import { tags } from '../public/tags.js';
import { hostReReview, OnboardingService } from './onboarding.service.js';
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
    private readonly refresh: PublicRefreshService,
  ) {}

  async slugAvailable(userId: string, kind: 'vendor' | 'organizer', slug: string) {
    return { available: await slugAvailable(this.prisma, kind, slug, userId) };
  }

  async updateVendor(userId: string, input: z.output<typeof vendorProfileUpdateSchema>) {
    const vendorProfileId = await this.prisma.$transaction(async (tx) => {
      await lockVendor(tx, userId);
      const role = await this.onboarding.requireRole(tx, userId, 'vendor');
      const current = await tx.vendorProfile.findUnique({ where: { userId } });
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
      await retireFiles(tx, await this.onboarding.pictureIds(tx, userId, profile.id), [input.avatarFileId, ...photoIds]);
      await tx.user.update({ where: { id: userId }, data: { avatarFileId: input.avatarFileId } });
      await tx.vendorProfileCategory.deleteMany({ where: { vendorProfileId: profile.id } });
      await tx.vendorProfileCategory.createMany({
        data: [...new Set(input.categoryIds)].map((categoryId) => ({ vendorProfileId: profile.id, categoryId })),
      });
      await tx.vendorProfilePhoto.deleteMany({ where: { vendorProfileId: profile.id } });
      await tx.vendorProfilePhoto.createMany({
        data: photoIds.map((fileId, sortOrder) => ({ vendorProfileId: profile.id, fileId, sortOrder })),
      });
      // An approved pop-up host who changes the shop name or adds a link the
      // admin didn't review goes back to review (spec §4.7).
      if (current) await hostReReview(tx, userId, role, current, input);
      return profile.id;
    });
    // The vendor page, and the event pages that list this vendor (decision Q1).
    void this.refresh.refresh([tags.vendor(vendorProfileId)]);
    return this.onboarding.state(userId);
  }

  async updateOrganizer(userId: string, input: z.output<typeof organizerProfileUpdateSchema>) {
    const organizerProfileId = await this.prisma.$transaction(async (tx) => {
      await lockOrganizer(tx, userId);
      const role = await this.onboarding.requireRole(tx, userId, 'organizer');
      if (!(await slugAvailable(tx, 'organizer', input.slug, userId))) throw new ConflictException(TAKEN);
      if (input.logoFileId) await assertAttachable(tx, input.logoFileId, userId, 'organizer_logo');
      const current = await tx.organizerProfile.findUnique({ where: { userId } });
      await retireFiles(tx, [current?.logoFileId], [input.logoFileId]);

      const data = {
        displayName: input.displayName,
        slug: input.slug,
        logoFileId: input.logoFileId,
        city: input.city ?? null,
        about: input.about ?? null,
        socialLinks: input.socialLinks,
      };
      const profile = await tx.organizerProfile.upsert({ where: { userId }, update: data, create: { ...data, userId } });

      const reReview =
        current !== null &&
        needsReReview(
          role.approvalStatus,
          { displayName: current.displayName, reviewedLinks: (role.reviewedLinks ?? []) as string[] },
          input,
        );
      await tx.userRole.update({ where: { id: role.id }, data: { contactEmail: input.contactEmail } });
      if (reReview) {
        await changeApprovalStatus(tx, {
          roleId: role.id,
          from: role.approvalStatus,
          action: 're_review',
          actorUserId: userId,
          data: { approvalSubmittedAt: new Date() },
        });
      }
      return profile.id;
    });
    // The organizer page, their event pages, and the listing cards.
    void this.refresh.refresh([tags.organizer(organizerProfileId), tags.listing]);
    return this.onboarding.state(userId);
  }
}
