import { BadRequestException, Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import {
  onboardingStateSchema,
  organizerProfileUpdateSchema,
  slugCheckSchema,
  slugSchema,
  vendorProfileUpdateSchema,
} from '@creavent/shared';
import type { z } from 'zod';
import { AuthGuard, CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { OnboardingService } from './onboarding.service.js';
import { ProfilesService } from './profiles.service.js';

@Controller()
@UseGuards(AuthGuard)
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly onboarding: OnboardingService,
  ) {}

  // The signed-in user's profiles, for the profile edit pages.
  @Get('profile')
  @ResponseSchema(onboardingStateSchema)
  state(@CurrentUser() user: SessionUser) {
    return this.onboarding.state(user.id);
  }

  @Get('profile/slug-available')
  @ResponseSchema(slugCheckSchema)
  slugAvailable(@CurrentUser() user: SessionUser, @Query('kind') kind: string, @Query('slug') slug: string) {
    const parsed = slugSchema.safeParse(slug ?? '');
    if (kind !== 'vendor' && kind !== 'organizer') throw new BadRequestException('kind must be vendor or organizer');
    if (!parsed.success) return { available: false };
    return this.profiles.slugAvailable(user.id, kind, parsed.data);
  }

  @Put('vendor/profile')
  @ResponseSchema(onboardingStateSchema)
  vendor(@CurrentUser() user: SessionUser, @Body({ schema: vendorProfileUpdateSchema }) body: z.output<typeof vendorProfileUpdateSchema>) {
    return this.profiles.updateVendor(user.id, body);
  }

  @Put('organizer/profile')
  @ResponseSchema(onboardingStateSchema)
  organizer(
    @CurrentUser() user: SessionUser,
    @Body({ schema: organizerProfileUpdateSchema }) body: z.output<typeof organizerProfileUpdateSchema>,
  ) {
    return this.profiles.updateOrganizer(user.id, body);
  }
}
