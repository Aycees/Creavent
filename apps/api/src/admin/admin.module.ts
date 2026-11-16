import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { AdminSearchService } from './admin-search.service.js';
import { AdminController } from './admin.controller.js';

// Admin pages beyond approvals and reports (sitemap §6).
@Module({ controllers: [AdminController], providers: [AdminSearchService, AdminGuard] })
export class AdminModule {}
