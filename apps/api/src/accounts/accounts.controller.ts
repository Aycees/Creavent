import { Body, Controller, Get, HttpCode, Patch, Post, Put, UseGuards } from '@nestjs/common';
import {
  acceptLegalSchema,
  meResponseSchema,
  publicConfigSchema,
  updatePhoneSchema,
  updateProfileSchema,
  type AcceptLegalInput,
  type PublicConfig,
} from '@creavent/shared';
import type { z } from 'zod';
import { AuthGuard, CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { appConfig } from '../config.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { AccountsService } from './accounts.service.js';

@Controller()
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  @ResponseSchema(meResponseSchema)
  me(@CurrentUser() user: SessionUser) {
    return this.accounts.me(user.id);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  @ResponseSchema(meResponseSchema)
  updateProfile(@CurrentUser() user: SessionUser, @Body({ schema: updateProfileSchema }) body: z.output<typeof updateProfileSchema>) {
    return this.accounts.updateProfile(user.id, body.fullName);
  }

  @Put('me/phone')
  @UseGuards(AuthGuard)
  @ResponseSchema(meResponseSchema)
  updatePhone(@CurrentUser() user: SessionUser, @Body({ schema: updatePhoneSchema }) body: z.output<typeof updatePhoneSchema>) {
    return this.accounts.updatePhone(user.id, body.phone);
  }

  @Post('me/legal')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ResponseSchema(meResponseSchema)
  async acceptLegal(
    @CurrentUser() user: SessionUser,
    @Body({ schema: acceptLegalSchema }) _body: AcceptLegalInput,
  ) {
    await this.accounts.acceptLegal(user.id);
    return this.accounts.me(user.id);
  }

  @Get('public-config')
  @ResponseSchema(publicConfigSchema)
  publicConfig(): PublicConfig {
    const { termsVersion, privacyVersion, minimumAge, supportEmail } = appConfig();
    const googleSignIn = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    return { termsVersion, privacyVersion, minimumAge, supportEmail, googleSignIn };
  }
}
