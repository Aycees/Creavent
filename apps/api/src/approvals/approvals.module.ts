import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { ApprovalsController } from './approvals.controller.js';
import { ApprovalsService } from './approvals.service.js';

@Module({ controllers: [ApprovalsController], providers: [ApprovalsService, AdminGuard] })
export class ApprovalsModule {}
