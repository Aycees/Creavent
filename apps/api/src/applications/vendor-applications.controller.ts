import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import { applyFormSchema, applySchema, createdApplicationSchema } from '@creavent/shared';
import type { z } from 'zod';
import { AuthGuard, CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { VendorApplicationsService } from './vendor-applications.service.js';

@Controller()
@UseGuards(AuthGuard)
export class VendorApplicationsController {
  constructor(private readonly applications: VendorApplicationsService) {}

  @Get('vendor/events/:slug/apply')
  @ResponseSchema(applyFormSchema)
  form(@CurrentUser() user: SessionUser, @Param('slug') slug: string) {
    return this.applications.form(user.id, slug);
  }

  @Post('vendor/events/:slug/applications')
  @ApiCreatedResponse({ standardSchema: createdApplicationSchema })
  apply(@CurrentUser() user: SessionUser, @Param('slug') slug: string, @Body({ schema: applySchema }) body: z.output<typeof applySchema>) {
    return this.applications.apply(user.id, slug, body);
  }

  @Post('vendor/applications/:id/withdraw')
  @ApiCreatedResponse({ standardSchema: createdApplicationSchema })
  withdraw(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.applications.withdraw(user.id, id);
  }
}
