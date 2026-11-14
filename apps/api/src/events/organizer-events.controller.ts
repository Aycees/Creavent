import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import {
  createdEventSchema,
  createEventSchema,
  eventDetailsSchema,
  eventSetupSchema,
  eventTypeSchema,
} from '@creavent/shared';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { OrganizerEventsService } from './organizer-events.service.js';

@Controller()
@UseGuards(AuthGuard)
export class OrganizerEventsController {
  constructor(private readonly events: OrganizerEventsService) {}

  @Get('event-types')
  @ResponseSchema(z.object({ eventTypes: z.array(eventTypeSchema) }))
  async eventTypes() {
    return { eventTypes: await this.events.eventTypes() };
  }

  @Post('organizer/events')
  @ApiCreatedResponse({ standardSchema: createdEventSchema })
  create(@CurrentUser() user: SessionUser, @Body({ schema: createEventSchema }) body: z.output<typeof createEventSchema>) {
    return this.events.create(user.id, body);
  }

  @Get('organizer/events/:id')
  @ResponseSchema(eventSetupSchema)
  setup(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.setup(user.id, id);
  }

  @Put('organizer/events/:id/details')
  @ResponseSchema(eventSetupSchema)
  details(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: eventDetailsSchema }) body: z.output<typeof eventDetailsSchema>,
  ) {
    return this.events.updateDetails(user.id, id, body);
  }
}
