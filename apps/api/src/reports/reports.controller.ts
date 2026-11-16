import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import {
  addEmailReportSchema,
  createReportSchema,
  myReportQuerySchema,
  myReportSchema,
  reportCreatedSchema,
  reportDetailSchema,
  reportGroupsSchema,
  reportListQuerySchema,
  resolveReportSchema,
} from '@creavent/shared';
import type { z } from 'zod';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthGuard, CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { ReportsService } from './reports.service.js';

// The report button, for signed-in users (spec §2.2).
@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @ResponseSchema(reportCreatedSchema)
  create(@CurrentUser() user: SessionUser, @Body({ schema: createReportSchema }) body: z.output<typeof createReportSchema>) {
    return this.reports.create(user.id, body);
  }

  @Get('mine')
  @ResponseSchema(myReportSchema)
  mine(@CurrentUser() user: SessionUser, @Query({ schema: myReportQuerySchema }) query: z.output<typeof myReportQuerySchema>) {
    return this.reports.mine(user.id, query.targetType, query.targetId);
  }
}

// The report queue (sitemap §6, flow 11).
@Controller('admin/reports')
@UseGuards(AdminGuard)
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @ResponseSchema(reportGroupsSchema)
  list(@Query({ schema: reportListQuerySchema }) query: z.output<typeof reportListQuerySchema>) {
    return this.reports.groups(query.status);
  }

  @Post()
  @ResponseSchema(reportCreatedSchema)
  add(@CurrentUser() admin: SessionUser, @Body({ schema: addEmailReportSchema }) body: z.output<typeof addEmailReportSchema>) {
    return this.reports.addFromEmail(admin.id, body);
  }

  @Get(':id')
  @ResponseSchema(reportDetailSchema)
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.reports.detail(id);
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @ResponseSchema(reportDetailSchema)
  resolve(
    @CurrentUser() admin: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: resolveReportSchema }) body: z.output<typeof resolveReportSchema>,
  ) {
    return this.reports.resolve(admin.id, id, body);
  }
}
