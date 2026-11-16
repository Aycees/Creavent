import { Controller, Get, Param, Query } from '@nestjs/common';
import { listingQuerySchema, listingSchema, publicEventResponseSchema, publicOrganizerPageSchema, publicVendorPageSchema } from '@creavent/shared';
import type { z } from 'zod';
import { ResponseSchema } from '../response-schema.decorator.js';
import { PublicPagesService } from './public-pages.service.js';

// Public pages, read without a session so the web app can cache them for
// everyone (decision Q1). Signed-in viewers also ask /api/events/:slug for
// their own view.
@Controller('public')
export class PublicController {
  constructor(private readonly pages: PublicPagesService) {}

  @Get('events')
  @ResponseSchema(listingSchema)
  listing(@Query({ schema: listingQuerySchema }) query: z.output<typeof listingQuerySchema>) {
    return this.pages.listing(query);
  }

  @Get('events/:slug')
  @ResponseSchema(publicEventResponseSchema)
  event(@Param('slug') slug: string) {
    return this.pages.event(slug);
  }

  @Get('organizers/:slug')
  @ResponseSchema(publicOrganizerPageSchema)
  organizer(@Param('slug') slug: string) {
    return this.pages.organizerPage(slug);
  }

  @Get('vendors/:slug')
  @ResponseSchema(publicVendorPageSchema)
  vendor(@Param('slug') slug: string) {
    return this.pages.vendorPage(slug);
  }
}
