import { Injectable } from '@nestjs/common';
import type { AccountDetails, MeResponse } from '@creavent/shared';
import { appConfig } from '../config.js';
import { needsLegal, recordLegalAcceptance } from '../auth/legal.js';
import { assertAttachable, FilesService, retireFiles } from '../files/files.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async me(userId: string): Promise<MeResponse> {
    const config = appConfig();
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        avatarFile: true,
        roles: { orderBy: { role: 'asc' } },
        accounts: { where: { providerId: 'credential' }, select: { id: true } },
      },
    });
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarFile ? this.files.url(user.avatarFile.storageKey) : null,
      isAdmin: user.isAdmin,
      needsLegal: await needsLegal(this.prisma, user.id, config),
      hasPassword: user.accounts.length > 0,
      roles: user.roles.map((r) => ({
        role: r.role,
        approvalStatus: r.approvalStatus,
        rejectionReason: r.rejectionReason,
        onboardingStep: r.onboardingStep,
        suspended: r.suspendedAt !== null,
        suspensionReason: r.suspensionReason,
      })),
    };
  }

  async updateProfile(userId: string, input: { fullName: string; phone?: string }) {
    await this.prisma.user.update({ where: { id: userId }, data: input });
    return this.me(userId);
  }

  async updateAvatar(userId: string, avatarFileId: string | null) {
    await this.prisma.$transaction(async (tx) => {
      if (avatarFileId) await assertAttachable(tx, avatarFileId, userId, 'avatar');
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarFileId: true } });
      await retireFiles(tx, [user.avatarFileId], [avatarFileId]);
      await tx.user.update({ where: { id: userId }, data: { avatarFileId } });
    });
    return this.me(userId);
  }

  // The account page's sign-in and history details (mockup Account).
  async details(userId: string): Promise<AccountDetails> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { accounts: true, legalAcceptances: { orderBy: { acceptedAt: 'desc' } }, roles: true, vendorProfile: true, organizerProfile: true },
    });
    const password = user.accounts.find((a) => a.providerId === 'credential');
    const latest = (document: 'terms' | 'privacy') => user.legalAcceptances.find((a) => a.document === document);
    const roleSince = (role: 'vendor' | 'organizer') => user.roles.find((r) => r.role === role)?.createdAt.toISOString();
    return {
      passwordChangedAt: password ? password.updatedAt.toISOString() : null,
      googleLinked: user.accounts.some((a) => a.providerId === 'google'),
      legal: (['terms', 'privacy'] as const).flatMap((document) => {
        const a = latest(document);
        return a ? [{ document, version: a.version, acceptedAt: a.acceptedAt.toISOString() }] : [];
      }),
      vendor: user.vendorProfile && roleSince('vendor') ? { shopName: user.vendorProfile.shopName, since: roleSince('vendor')! } : null,
      organizer:
        user.organizerProfile && roleSince('organizer')
          ? { displayName: user.organizerProfile.displayName, since: roleSince('organizer')! }
          : null,
    };
  }

  // Accepts the current versions and confirms the age, for users who signed
  // up with Google or signed in after the terms changed (spec §1).
  async acceptLegal(userId: string) {
    const config = appConfig();
    await this.prisma.$transaction(async (tx) => {
      if (await needsLegal(tx, userId, config)) {
        await recordLegalAcceptance(tx, userId, config);
      }
      await tx.user.updateMany({
        where: { id: userId, ageConfirmedAt: null },
        data: { ageConfirmedAt: new Date() },
      });
    });
  }
}
