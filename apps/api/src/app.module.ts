import { Module } from '@nestjs/common';
import { AccountsModule } from './accounts/accounts.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health/health.controller.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule, AuthModule, AccountsModule],
  controllers: [HealthController],
})
export class AppModule {}
