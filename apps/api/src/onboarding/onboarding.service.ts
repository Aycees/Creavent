import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  chooseRolesSchema,
  organizerApprovalSchema,
  organizerContactSchema,
  organizerPageSchema,
  vendorContactSchema,
  vendorPhotosSchema,
  vendorShopSchema,
  type OnboardingState,
  type RoleType,
} from '@creavent/shared';
import type { z } from 'zod';
import { assertApprovalChange, changeApprovalStatus, lockOrganizer, sameLinks } from '../approvals/approval-status.js';
import { assertAttachable, FilesService, retireFiles } from '../files/files.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { freeSlug, slugAvailable } from './slugs.js';

// Onboarding (spec §1.1): each step saves its fields and records the furthest
// step reached for the role.
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async state(userId: string): Promise<OnboardingState> {
    const [categories, user] = await Promise.all([
      this.prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: {
          avatarFile: true,
          roles: true,
          vendorProfile: {
            include: {
              categories: { include: { category: true } },
              photos: { include: { file: true }, orderBy: { sortOrder: 'asc' } },
            },
          },
          organizerProfile: { include: { logoFile: true } },
        },
      }),
    ]);
    const organizerRole = user.roles.find((r) => r.role === 'organizer');
    const v = user.vendorProfile;
    const o = user.organizerProfile;
    const image = (f: { id: string; storageKey: string } | null | undefined) =>
      f ? { id: f.id, url: this.files.url(f.storageKey) } : null;
    return {
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      phone: user.phone,
      avatar: image(user.avatarFile),
      vendor: v && {
        shopName: v.shopName,
        slug: v.slug,
        categoryIds: v.categories.sort((a, b) => a.category.sortOrder - b.category.sortOrder).map((c) => c.categoryId),
        description: v.description,
        products: v.products,
        photos: v.photos.map((p) => image(p.file)!),
        socialLinks: v.socialLinks as string[],
      },
      organizer:
        organizerRole && o
          ? {
              displayName: o.displayName,
              slug: o.slug,
              logo: image(o.logoFile),
              city: o.city,
              about: o.about,
              socialLinks: o.socialLinks as string[],
              contactEmail: organizerRole.contactEmail,
              approvalStatus: organizerRole.approvalStatus ?? 'not_submitted',
              approvalSubmittedAt: organizerRole.approvalSubmittedAt?.toISOString() ?? null,
              reviewedAt: organizerRole.reviewedAt?.toISOString() ?? null,
              rejectionReason: organizerRole.rejectionReason,
              reviewedLinks: (organizerRole.reviewedLinks ?? []) as string[],
            }
          : null,
    };
  }

  async chooseRoles(userId: string, input: z.output<typeof chooseRolesSchema>) {
    await this.prisma.$transaction(async (tx) => {
      for (const role of new Set(input.roles)) {
        await tx.userRole.upsert({
          where: { userId_role: { userId, role } },
          update: {},
          create: { userId, role, approvalStatus: role === 'organizer' ? 'not_submitted' : null, onboardingStep: 1 },
        });
      }
    });
    return this.state(userId);
  }

  async vendorShop(userId: string, input: z.output<typeof vendorShopSchema>) {
    await this.prisma.$transaction(async (tx) => {
      await this.requireRole(tx, userId, 'vendor');
      const active = await tx.category.count({ where: { id: { in: input.categoryIds }, isActive: true } });
      if (active !== new Set(input.categoryIds).size) throw new BadRequestException('Pick categories from the list');
      const existing = await tx.vendorProfile.findUnique({ where: { userId } });
      const data = { shopName: input.shopName, description: input.description ?? null, products: input.products ?? null };
      const profile = existing
        ? await tx.vendorProfile.update({ where: { userId }, data })
        : await tx.vendorProfile.create({ data: { ...data, userId, slug: await freeSlug(tx, 'vendor', input.shopName, userId) } });
      await tx.vendorProfileCategory.deleteMany({ where: { vendorProfileId: profile.id } });
      await tx.vendorProfileCategory.createMany({
        data: [...new Set(input.categoryIds)].map((categoryId) => ({ vendorProfileId: profile.id, categoryId })),
      });
      await this.reachStep(tx, userId, 'vendor', 2);
    });
    return this.state(userId);
  }

  async vendorPhotos(userId: string, input: z.output<typeof vendorPhotosSchema>) {
    await this.prisma.$transaction(async (tx) => {
      await this.requireRole(tx, userId, 'vendor');
      const profile = await this.vendorProfile(tx, userId);
      if (input.avatarFileId) await assertAttachable(tx, input.avatarFileId, userId, 'avatar');
      const photoIds = [...new Set(input.photoFileIds)];
      for (const id of photoIds) await assertAttachable(tx, id, userId, 'vendor_photo');
      const before = await this.pictureIds(tx, userId, profile.id);
      await retireFiles(tx, before, [input.avatarFileId, ...photoIds]);
      await tx.user.update({ where: { id: userId }, data: { avatarFileId: input.avatarFileId } });
      await tx.vendorProfilePhoto.deleteMany({ where: { vendorProfileId: profile.id } });
      await tx.vendorProfilePhoto.createMany({
        data: photoIds.map((fileId, sortOrder) => ({ vendorProfileId: profile.id, fileId, sortOrder })),
      });
      await this.reachStep(tx, userId, 'vendor', 3);
    });
    return this.state(userId);
  }

  async vendorContact(userId: string, input: z.output<typeof vendorContactSchema>) {
    await this.prisma.$transaction(async (tx) => {
      await this.requireRole(tx, userId, 'vendor');
      await this.vendorProfile(tx, userId);
      await tx.user.update({ where: { id: userId }, data: { phone: input.phone } });
      await tx.vendorProfile.update({ where: { userId }, data: { socialLinks: input.socialLinks } });
      await this.reachStep(tx, userId, 'vendor', 4);
    });
    return this.state(userId);
  }

  async organizerPage(userId: string, input: z.output<typeof organizerPageSchema>) {
    await this.prisma.$transaction(async (tx) => {
      await lockOrganizer(tx, userId);
      await this.requireRole(tx, userId, 'organizer');
      if (!(await slugAvailable(tx, 'organizer', input.slug, userId))) {
        throw new ConflictException('This link is taken. Try another.');
      }
      if (input.logoFileId) await assertAttachable(tx, input.logoFileId, userId, 'organizer_logo');
      const current = await tx.organizerProfile.findUnique({ where: { userId } });
      await retireFiles(tx, [current?.logoFileId], [input.logoFileId]);
      if (current && (current.displayName !== input.displayName || current.slug !== input.slug)) {
        await this.assertNotReviewed(tx, userId);
      }
      const data = {
        displayName: input.displayName,
        slug: input.slug,
        logoFileId: input.logoFileId,
        city: input.city ?? null,
        about: input.about ?? null,
      };
      await tx.organizerProfile.upsert({ where: { userId }, update: data, create: { ...data, userId } });
      await this.reachStep(tx, userId, 'organizer', 2);
    });
    return this.state(userId);
  }

  async organizerContact(userId: string, input: z.output<typeof organizerContactSchema>) {
    await this.prisma.$transaction(async (tx) => {
      await this.requireRole(tx, userId, 'organizer');
      await this.organizerProfile(tx, userId);
      await tx.user.update({ where: { id: userId }, data: { phone: input.phone } });
      await tx.userRole.update({
        where: { userId_role: { userId, role: 'organizer' } },
        data: { contactEmail: input.contactEmail },
      });
      await this.reachStep(tx, userId, 'organizer', 3);
    });
    return this.state(userId);
  }

  // Step 4, and /organizer/approval later: save the links, and request a
  // review when asked (spec §2.1).
  async organizerApproval(userId: string, input: z.output<typeof organizerApprovalSchema>) {
    await this.prisma.$transaction(async (tx) => {
      await lockOrganizer(tx, userId);
      const role = await this.requireRole(tx, userId, 'organizer');
      const profile = await this.organizerProfile(tx, userId);
      if (!sameLinks(profile.socialLinks, input.socialLinks)) {
        await this.assertNotReviewed(tx, userId);
      }
      await tx.organizerProfile.update({ where: { userId }, data: { socialLinks: input.socialLinks } });
      if (input.submit) {
        assertApprovalChange(role.approvalStatus, 'submit');
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        if (!user.phone || !role.contactEmail) {
          throw new BadRequestException('Add your mobile number and contact email first');
        }
        await changeApprovalStatus(tx, {
          roleId: role.id,
          from: role.approvalStatus,
          action: 'submit',
          actorUserId: userId,
          data: { approvalSubmittedAt: new Date(), rejectionReason: null },
        });
      }
      await this.reachStep(tx, userId, 'organizer', 4);
    });
    return this.state(userId);
  }

  async requireRole(tx: Tx, userId: string, role: RoleType) {
    const found = await tx.userRole.findUnique({ where: { userId_role: { userId, role } } });
    if (!found) throw new ForbiddenException(`Add the ${role} role first`);
    if (found.suspendedAt) throw new ForbiddenException(`Your ${role} role is suspended`);
    return found;
  }

  // The name, page link, and links are what the admin reviews (spec §2.1).
  // While a review is pending or after approval they stay as reviewed, so the
  // badge can't move to a different page. How organizers change them later is
  // an open question (docs/open-questions.md).
  private async assertNotReviewed(tx: Tx, userId: string) {
    const role = await tx.userRole.findUniqueOrThrow({ where: { userId_role: { userId, role: 'organizer' } } });
    if (role.approvalStatus === 'pending_review' || role.approvalStatus === 'approved') {
      throw new ConflictException(
        'Your name, page link, and links were sent for review. Email support to change them.',
      );
    }
  }

  // The vendor's profile picture and photos, to find the ones a change drops.
  async pictureIds(tx: Tx, userId: string, vendorProfileId: string) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarFileId: true } });
    const photos = await tx.vendorProfilePhoto.findMany({ where: { vendorProfileId }, select: { fileId: true } });
    return [user.avatarFileId, ...photos.map((p) => p.fileId)];
  }

  private async vendorProfile(tx: Tx, userId: string) {
    const profile = await tx.vendorProfile.findUnique({ where: { userId } });
    if (!profile) throw new BadRequestException('Tell us about your shop first');
    return profile;
  }

  private async organizerProfile(tx: Tx, userId: string) {
    const profile = await tx.organizerProfile.findUnique({ where: { userId } });
    if (!profile) throw new BadRequestException('Set up your organizer page first');
    return profile;
  }

  // The furthest step only moves forward, so saving an earlier step again
  // doesn't undo progress.
  private async reachStep(tx: Tx, userId: string, role: RoleType, step: number) {
    await tx.userRole.updateMany({
      where: { userId, role, OR: [{ onboardingStep: null }, { onboardingStep: { lt: step } }] },
      data: { onboardingStep: step },
    });
  }
}
