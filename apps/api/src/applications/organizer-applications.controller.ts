import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import { decisionSchema, eventApplicationsSchema, reapplySchema } from '@creavent/shared';
import type { z } from 'zod';
import { AuthGuard, CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { OrganizerApplicationsService } from './organizer-applications.service.js';

@Controller('organizer/events/:id/applications')
@UseGuards(AuthGuard)
export class OrganizerApplicationsController {
  constructor(private readonly applications: OrganizerApplicationsService) {}

  @Get()
  @ResponseSchema(eventApplicationsSchema)
  list(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.applications.list(user.id, id);
  }

  @Post(':applicationId/approve')
  @ApiCreatedResponse({ standardSchema: eventApplicationsSchema })
  @ResponseSchema(eventApplicationsSchema)
  approve(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body({ schema: decisionSchema }) body: z.output<typeof decisionSchema>,
  ) {
    return this.applications.decide(user.id, id, applicationId, 'approve', body.note);
  }

  @Post(':applicationId/decline')
  @ApiCreatedResponse({ standardSchema: eventApplicationsSchema })
  @ResponseSchema(eventApplicationsSchema)
  decline(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body({ schema: decisionSchema }) body: z.output<typeof decisionSchema>,
  ) {
    return this.applications.decide(user.id, id, applicationId, 'decline', body.note);
  }

  @Post(':applicationId/reapply')
  @ApiCreatedResponse({ standardSchema: eventApplicationsSchema })
  @ResponseSchema(eventApplicationsSchema)
  reapply(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body({ schema: reapplySchema }) body: z.output<typeof reapplySchema>,
  ) {
    return this.applications.reapply(user.id, id, applicationId, body.canReapply);
  }
}
