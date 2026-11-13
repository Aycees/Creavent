import { Body, Controller, Get, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
import {
  chooseRolesSchema,
  onboardingStateSchema,
  organizerApprovalSchema,
  organizerContactSchema,
  organizerPageSchema,
  vendorContactSchema,
  vendorPhotosSchema,
  vendorShopSchema,
} from '@creavent/shared';
import type { z } from 'zod';
import { AuthGuard, CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { OnboardingService } from './onboarding.service.js';

// Every route answers with the whole onboarding state, so the screen can move
// to the next step without another request.
@Controller('onboarding')
@UseGuards(AuthGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  @ResponseSchema(onboardingStateSchema)
  state(@CurrentUser() user: SessionUser) {
    return this.onboarding.state(user.id);
  }

  @Put('roles')
  @ResponseSchema(onboardingStateSchema)
  roles(@CurrentUser() user: SessionUser, @Body({ schema: chooseRolesSchema }) body: z.output<typeof chooseRolesSchema>) {
    return this.onboarding.chooseRoles(user.id, body);
  }

  @Put('vendor/shop')
  @ResponseSchema(onboardingStateSchema)
  vendorShop(@CurrentUser() user: SessionUser, @Body({ schema: vendorShopSchema }) body: z.output<typeof vendorShopSchema>) {
    return this.onboarding.vendorShop(user.id, body);
  }

  @Put('vendor/photos')
  @ResponseSchema(onboardingStateSchema)
  vendorPhotos(@CurrentUser() user: SessionUser, @Body({ schema: vendorPhotosSchema }) body: z.output<typeof vendorPhotosSchema>) {
    return this.onboarding.vendorPhotos(user.id, body);
  }

  @Put('vendor/contact')
  @ResponseSchema(onboardingStateSchema)
  vendorContact(@CurrentUser() user: SessionUser, @Body({ schema: vendorContactSchema }) body: z.output<typeof vendorContactSchema>) {
    return this.onboarding.vendorContact(user.id, body);
  }

  @Put('organizer/page')
  @ResponseSchema(onboardingStateSchema)
  organizerPage(@CurrentUser() user: SessionUser, @Body({ schema: organizerPageSchema }) body: z.output<typeof organizerPageSchema>) {
    return this.onboarding.organizerPage(user.id, body);
  }

  @Put('organizer/contact')
  @ResponseSchema(onboardingStateSchema)
  organizerContact(
    @CurrentUser() user: SessionUser,
    @Body({ schema: organizerContactSchema }) body: z.output<typeof organizerContactSchema>,
  ) {
    return this.onboarding.organizerContact(user.id, body);
  }

  @Post('organizer/approval')
  @HttpCode(200)
  @ResponseSchema(onboardingStateSchema)
  organizerApproval(
    @CurrentUser() user: SessionUser,
    @Body({ schema: organizerApprovalSchema }) body: z.output<typeof organizerApprovalSchema>,
  ) {
    return this.onboarding.organizerApproval(user.id, body);
  }
}
