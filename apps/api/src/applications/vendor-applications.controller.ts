import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import { applicationSlotsSchema, changeSlotSchema, preferenceSchema, applyFormSchema, applySchema, createdApplicationSchema, uploadProofSchema, vendorApplicationSchema, vendorApplicationsSchema, vendorDashboardSchema } from '@creavent/shared';
import type { z } from 'zod';
import { AuthGuard, CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { PaymentsService } from './payments.service.js';
import { VendorApplicationsService } from './vendor-applications.service.js';

@Controller()
@UseGuards(AuthGuard)
export class VendorApplicationsController {
  constructor(
    private readonly applications: VendorApplicationsService,
    private readonly payments: PaymentsService,
  ) {}

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

  @Get('vendor/dashboard')
  @ResponseSchema(vendorDashboardSchema)
  dashboard(@CurrentUser() user: SessionUser) {
    return this.applications.dashboard(user.id);
  }

  @Get('vendor/applications')
  @ResponseSchema(vendorApplicationsSchema)
  list(@CurrentUser() user: SessionUser) {
    return this.applications.list(user.id);
  }

  @Get('vendor/applications/:id')
  @ResponseSchema(vendorApplicationSchema)
  detail(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.applications.detail(user.id, id);
  }

  // Proof of payment (spec §6.2). Answers with the application page.
  @Post('vendor/applications/:id/proofs')
  @ApiCreatedResponse({ standardSchema: vendorApplicationSchema })
  @ResponseSchema(vendorApplicationSchema)
  async uploadProof(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: uploadProofSchema }) body: z.output<typeof uploadProofSchema>) {
    await this.payments.uploadProof(user.id, id, body);
    return this.applications.detail(user.id, id);
  }

  @Post('vendor/applications/:id/release')
  @ApiCreatedResponse({ standardSchema: vendorApplicationSchema })
  @ResponseSchema(vendorApplicationSchema)
  async release(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.applications.release(user.id, id);
    return this.applications.detail(user.id, id);
  }

  @Get('vendor/applications/:id/slots')
  @ResponseSchema(applicationSlotsSchema)
  slots(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.applications.slots(user.id, id);
  }

  @Put('vendor/applications/:id/preference')
  @ResponseSchema(vendorApplicationSchema)
  async preference(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: preferenceSchema }) body: z.output<typeof preferenceSchema>) {
    await this.applications.setPreference(user.id, id, body.preferredSlotIds);
    return this.applications.detail(user.id, id);
  }

  @Post('vendor/applications/:id/change-slot')
  @ApiCreatedResponse({ standardSchema: vendorApplicationSchema })
  @ResponseSchema(vendorApplicationSchema)
  async changeSlot(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: changeSlotSchema }) body: z.output<typeof changeSlotSchema>) {
    await this.applications.changeSlot(user.id, id, body.preferredSlotIds);
    return this.applications.detail(user.id, id);
  }

  @Post('vendor/applications/:id/withdraw')
  @ApiCreatedResponse({ standardSchema: createdApplicationSchema })
  withdraw(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.applications.withdraw(user.id, id);
  }
}
