import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { AdminEventsService } from './admin-events.service.js';
import { AdminSearchService } from './admin-search.service.js';
import { AdminUsersService } from './admin-users.service.js';
import { AdminController } from './admin.controller.js';

// Admin pages beyond approvals and reports (sitemap §6).
@Module({ controllers: [AdminController], providers: [AdminSearchService, AdminUsersService, AdminEventsService, ModerationService, AdminGuard] })
export class AdminModule {}
