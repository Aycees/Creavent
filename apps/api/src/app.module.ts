import { Module } from '@nestjs/common';
import { AccountsModule } from './accounts/accounts.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { AuthModule } from './auth/auth.module.js';
import { EventsModule } from './events/events.module.js';
import { FilesModule } from './files/files.module.js';
import { HealthController } from './health/health.controller.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PublicModule } from './public/public.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule, AuthModule, FilesModule, AccountsModule, OnboardingModule, ApprovalsModule, EventsModule, ApplicationsModule, PublicModule],
  controllers: [HealthController],
})
export class AppModule {}
