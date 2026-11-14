import { Module } from '@nestjs/common';
import { AccountsModule } from './accounts/accounts.module.js';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { AuthModule } from './auth/auth.module.js';
import { FilesModule } from './files/files.module.js';
import { HealthController } from './health/health.controller.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule, AuthModule, FilesModule, AccountsModule, OnboardingModule, ApprovalsModule],
  controllers: [HealthController],
})
export class AppModule {}
