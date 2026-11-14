import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller.js';
import { OnboardingService } from './onboarding.service.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';

@Module({ controllers: [OnboardingController, ProfilesController], providers: [OnboardingService, ProfilesService] })
export class OnboardingModule {}
