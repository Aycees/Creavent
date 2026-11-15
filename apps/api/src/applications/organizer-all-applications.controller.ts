import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { applicationDetailSchema, organizerApplicationsQuerySchema, organizerApplicationsSchema } from '@creavent/shared';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { OrganizerAllApplicationsService } from './organizer-all-applications.service.js';

@Controller('organizer/applications')
@UseGuards(AuthGuard)
export class OrganizerAllApplicationsController {
  constructor(private readonly applications: OrganizerAllApplicationsService) {}

  @Get()
  @ResponseSchema(organizerApplicationsSchema)
  list(@CurrentUser() user: SessionUser, @Query({ schema: organizerApplicationsQuerySchema }) query: z.output<typeof organizerApplicationsQuerySchema>) {
    return this.applications.list(user.id, query);
  }

  @Get('count')
  @ResponseSchema(z.object({ waiting: z.number().int() }))
  count(@CurrentUser() user: SessionUser) {
    return this.applications.waitingCount(user.id);
  }

  @Get(':id')
  @ResponseSchema(applicationDetailSchema)
  detail(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.applications.detail(user.id, id);
  }
}
