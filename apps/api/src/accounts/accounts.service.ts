import { Injectable } from '@nestjs/common';
import type { MeResponse } from '@creavent/shared';
import { appConfig } from '../config.js';
import { needsLegal, recordLegalAcceptance } from '../auth/legal.js';
import { FilesService } from '../files/files.service.js';
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
