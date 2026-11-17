import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { AdminReportsController, ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({ controllers: [ReportsController, AdminReportsController], providers: [ReportsService, ModerationService, AdminGuard] })
export class ReportsModule {}
