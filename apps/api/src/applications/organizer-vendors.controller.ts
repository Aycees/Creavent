import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import { assignSlotSchema, eventVendorsSchema } from '@creavent/shared';
import type { z } from 'zod';
import { AuthGuard, CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { OrganizerVendorsService } from './organizer-vendors.service.js';

@Controller('organizer/events/:id')
@UseGuards(AuthGuard)
export class OrganizerVendorsController {
  constructor(private readonly vendors: OrganizerVendorsService) {}

  @Get('vendors')
  @ResponseSchema(eventVendorsSchema)
  list(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.vendors.vendors(user.id, id);
  }

  @Post('assignments')
  @ApiCreatedResponse({ standardSchema: eventVendorsSchema })
  @ResponseSchema(eventVendorsSchema)
  assign(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: assignSlotSchema }) body: z.output<typeof assignSlotSchema>) {
    return this.vendors.assign(user.id, id, body.applicationId, body.slotId);
  }
}
