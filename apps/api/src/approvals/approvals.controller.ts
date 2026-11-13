import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { approvalDetailSchema, approvalQueueSchema, approveSchema, rejectSchema } from '@creavent/shared';
import type { z } from 'zod';
import { AdminGuard } from '../auth/admin.guard.js';
import { CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { ApprovalsService } from './approvals.service.js';

@Controller('admin/approvals')
@UseGuards(AdminGuard)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @ResponseSchema(approvalQueueSchema)
  async queue() {
    return { items: await this.approvals.queue() };
  }

  @Get(':userId')
  @ResponseSchema(approvalDetailSchema)
  detail(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.approvals.detail(userId);
  }

  @Post(':userId/approve')
  @HttpCode(200)
  @ResponseSchema(approvalDetailSchema)
  approve(
    @CurrentUser() admin: SessionUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body({ schema: approveSchema }) body: z.output<typeof approveSchema>,
  ) {
    return this.approvals.decide(admin.id, userId, { approve: true, note: body.note });
  }

  @Post(':userId/reject')
  @HttpCode(200)
  @ResponseSchema(approvalDetailSchema)
  reject(
    @CurrentUser() admin: SessionUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body({ schema: rejectSchema }) body: z.output<typeof rejectSchema>,
  ) {
    return this.approvals.decide(admin.id, userId, { approve: false, reason: body.reason, note: body.note });
  }
}
