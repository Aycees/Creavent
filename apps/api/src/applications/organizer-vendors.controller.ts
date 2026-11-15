import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import { approveProofSchema, assignSlotSchema, eventVendorsSchema, markPaidSchema, rejectProofSchema } from '@creavent/shared';
import type { z } from 'zod';
import { AuthGuard, CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { OrganizerVendorsService } from './organizer-vendors.service.js';
import { PaymentsService } from './payments.service.js';

@Controller('organizer/events/:id')
@UseGuards(AuthGuard)
export class OrganizerVendorsController {
  constructor(
    private readonly vendors: OrganizerVendorsService,
    private readonly payments: PaymentsService,
  ) {}

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

  @Post('proofs/:proofId/approve')
  @ApiCreatedResponse({ standardSchema: eventVendorsSchema })
  @ResponseSchema(eventVendorsSchema)
  async approveProof(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('proofId', ParseUUIDPipe) proofId: string,
    @Body({ schema: approveProofSchema }) body: z.output<typeof approveProofSchema>,
  ) {
    await this.payments.approveProof(user.id, id, proofId, body.amountPaid);
    return this.vendors.vendors(user.id, id);
  }

  @Post('proofs/:proofId/reject')
  @ApiCreatedResponse({ standardSchema: eventVendorsSchema })
  @ResponseSchema(eventVendorsSchema)
  async rejectProof(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('proofId', ParseUUIDPipe) proofId: string,
    @Body({ schema: rejectProofSchema }) body: z.output<typeof rejectProofSchema>,
  ) {
    await this.payments.rejectProof(user.id, id, proofId, body.reason);
    return this.vendors.vendors(user.id, id);
  }

  @Post('assignments/:assignmentId/mark-paid')
  @ApiCreatedResponse({ standardSchema: eventVendorsSchema })
  @ResponseSchema(eventVendorsSchema)
  async markPaid(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body({ schema: markPaidSchema }) body: z.output<typeof markPaidSchema>,
  ) {
    await this.payments.markPaid(user.id, id, assignmentId, body.note, body.method);
    return this.vendors.vendors(user.id, id);
  }
}
