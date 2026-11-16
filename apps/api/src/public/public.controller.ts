import { Controller, Get, Param } from '@nestjs/common';
import { publicEventResponseSchema } from '@creavent/shared';
import { ResponseSchema } from '../response-schema.decorator.js';
import { PublicPagesService } from './public-pages.service.js';

// Public pages, read without a session so the web app can cache them for
// everyone (decision Q1). Signed-in viewers also ask /api/events/:slug for
// their own view.
@Controller('public')
export class PublicController {
  constructor(private readonly pages: PublicPagesService) {}

  @Get('events/:slug')
  @ResponseSchema(publicEventResponseSchema)
  event(@Param('slug') slug: string) {
    return this.pages.event(slug);
  }
}
