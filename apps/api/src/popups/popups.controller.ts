import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import {
  cancelPopupSchema,
  createdPopupSchema,
  createPopupSchema,
  hostApprovalSchema,
  hostRequestSchema,
  popupDetailsSchema,
  popupSchema,
  popupsSchema,
  popupSummarySchema,
} from '@creavent/shared';
import type { z } from 'zod';
import { AuthGuard, CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { HostApprovalService } from './host-approval.service.js';
import { PopupsService } from './popups.service.js';

// A vendor's pop-ups and their host approval (spec §4.7, sitemap pop-up pages).
@Controller('vendor')
@UseGuards(AuthGuard)
export class PopupsController {
  constructor(
    private readonly popups: PopupsService,
    private readonly hostApproval: HostApprovalService,
  ) {}

  @Get('host-approval')
  @ResponseSchema(hostApprovalSchema)
  host(@CurrentUser() user: SessionUser) {
    return this.hostApproval.state(user.id);
  }

  @Post('host-approval')
  @HttpCode(200)
  @ResponseSchema(hostApprovalSchema)
  requestHost(@CurrentUser() user: SessionUser, @Body({ schema: hostRequestSchema }) body: z.output<typeof hostRequestSchema>) {
    return this.hostApproval.submit(user.id, body.socialLinks);
  }

  @Get('popups')
  @ResponseSchema(popupsSchema)
  list(@CurrentUser() user: SessionUser) {
    return this.popups.list(user.id);
  }

  @Get('popups/summary')
  @ResponseSchema(popupSummarySchema)
  summary(@CurrentUser() user: SessionUser) {
    return this.popups.summary(user.id);
  }

  @Post('popups')
  @ApiCreatedResponse({ standardSchema: createdPopupSchema })
  create(@CurrentUser() user: SessionUser, @Body({ schema: createPopupSchema }) body: z.output<typeof createPopupSchema>) {
    return this.popups.create(user.id, body);
  }

  @Get('popups/:id')
  @ResponseSchema(popupSchema)
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.popups.get(user.id, id);
  }

  @Put('popups/:id')
  @ResponseSchema(popupSchema)
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: popupDetailsSchema }) body: z.output<typeof popupDetailsSchema>) {
    return this.popups.update(user.id, id, body);
  }

  @Delete('popups/:id')
  @HttpCode(204)
  async deleteDraft(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.popups.deleteDraft(user.id, id);
  }

  @Post('popups/:id/announce')
  @HttpCode(200)
  @ResponseSchema(popupSchema)
  announce(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.popups.announce(user.id, id);
  }

  @Post('popups/:id/cancel')
  @HttpCode(200)
  @ResponseSchema(popupSchema)
  cancel(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: cancelPopupSchema }) body: z.output<typeof cancelPopupSchema>) {
    return this.popups.cancel(user.id, id, body.reason);
  }

  @Post('popups/:id/duplicate')
  @ApiCreatedResponse({ standardSchema: createdPopupSchema })
  duplicate(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.popups.duplicate(user.id, id);
  }
}
