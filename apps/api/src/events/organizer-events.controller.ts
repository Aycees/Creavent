import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import {
  applicationsToggleSchema,
  createdEventSchema,
  createEventSchema,
  eventDetailsSchema,
  eventPaymentsSchema,
  eventPolicySchema,
  eventRequirementsSchema,
  eventSetupSchema,
  eventTypeSchema,
  organizerEventsSchema,
  publicFloorPlanSchema,
  slotRowSchema,
  slotSchema,
  slotSettingsSchema,
} from '@creavent/shared';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { EventSlotsService } from './event-slots.service.js';
import { OrganizerEventsService } from './organizer-events.service.js';

@Controller()
@UseGuards(AuthGuard)
export class OrganizerEventsController {
  constructor(
    private readonly events: OrganizerEventsService,
    private readonly slots: EventSlotsService,
  ) {}

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

  @Get('organizer/events')
  @ResponseSchema(organizerEventsSchema)
  list(@CurrentUser() user: SessionUser) {
    return this.events.list(user.id);
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

  @Put('organizer/events/:id/requirements')
  @ResponseSchema(eventSetupSchema)
  requirements(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: eventRequirementsSchema }) body: z.output<typeof eventRequirementsSchema>,
  ) {
    return this.events.updateRequirements(user.id, id, body);
  }

  @Put('organizer/events/:id/policy')
  @ResponseSchema(eventSetupSchema)
  policy(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: eventPolicySchema }) body: z.output<typeof eventPolicySchema>,
  ) {
    return this.events.updatePolicy(user.id, id, body);
  }

  @Put('organizer/events/:id/payments')
  @ResponseSchema(eventSetupSchema)
  payments(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: eventPaymentsSchema }) body: z.output<typeof eventPaymentsSchema>,
  ) {
    return this.events.updatePayments(user.id, id, body);
  }

  @Post('organizer/events/:id/slots')
  @ApiCreatedResponse({ standardSchema: eventSetupSchema })
  @ResponseSchema(eventSetupSchema)
  addSlot(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: slotSchema }) body: z.output<typeof slotSchema>) {
    return this.slots.add(user.id, id, body);
  }

  @Post('organizer/events/:id/slots/row')
  @ApiCreatedResponse({ standardSchema: eventSetupSchema })
  @ResponseSchema(eventSetupSchema)
  addRow(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: slotRowSchema }) body: z.output<typeof slotRowSchema>) {
    return this.slots.addRow(user.id, id, body);
  }

  @Patch('organizer/events/:id/slots/:slotId')
  @ResponseSchema(eventSetupSchema)
  updateSlot(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @Body({ schema: slotSchema }) body: z.output<typeof slotSchema>,
  ) {
    return this.slots.update(user.id, id, slotId, body);
  }

  @Delete('organizer/events/:id/slots/:slotId')
  @ResponseSchema(eventSetupSchema)
  removeSlot(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Param('slotId', ParseUUIDPipe) slotId: string) {
    return this.slots.remove(user.id, id, slotId);
  }

  @Put('organizer/events/:id/slot-settings')
  @ResponseSchema(eventSetupSchema)
  slotSettings(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: slotSettingsSchema }) body: z.output<typeof slotSettingsSchema>,
  ) {
    return this.slots.settings(user.id, id, body);
  }

  @Put('organizer/events/:id/public-floor-plan')
  @ResponseSchema(eventSetupSchema)
  publicFloorPlan(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: publicFloorPlanSchema }) body: z.output<typeof publicFloorPlanSchema>,
  ) {
    return this.slots.publicFloorPlan(user.id, id, body);
  }

  @Post('organizer/events/:id/open')
  @ApiCreatedResponse({ standardSchema: eventSetupSchema })
  @ResponseSchema(eventSetupSchema)
  open(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.open(user.id, id);
  }

  @Put('organizer/events/:id/applications')
  @ResponseSchema(eventSetupSchema)
  applications(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: applicationsToggleSchema }) body: z.output<typeof applicationsToggleSchema>,
  ) {
    return this.events.setApplications(user.id, id, body.open);
  }
}
