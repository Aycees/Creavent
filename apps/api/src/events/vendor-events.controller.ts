import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { eventPageSchema, vendorEventsQuerySchema, vendorEventsResponseSchema } from '@creavent/shared';
import type { z } from 'zod';
import { AuthGuard, CurrentUser, OptionalAuthGuard, OptionalUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { VendorEventsService } from './vendor-events.service.js';

@Controller()
export class VendorEventsController {
  constructor(private readonly events: VendorEventsService) {}

  @Get('vendor/events')
  @UseGuards(AuthGuard)
  @ResponseSchema(vendorEventsResponseSchema)
  browse(@CurrentUser() user: SessionUser, @Query({ schema: vendorEventsQuerySchema }) query: z.output<typeof vendorEventsQuerySchema>) {
    return this.events.browse(user.id, query);
  }

  // The event page (sitemap §3). Anyone can ask; what they see depends on who
  // they are and the event's status.
  @Get('events/:slug')
  @UseGuards(OptionalAuthGuard)
  @ResponseSchema(eventPageSchema)
  page(@OptionalUser() user: SessionUser | undefined, @Param('slug') slug: string) {
    return this.events.page(user, slug);
  }
}
