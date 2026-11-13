import { BadRequestException, Body, Controller, Get, HttpCode, Patch, Post, Put, UseGuards } from '@nestjs/common';
import {
  acceptLegalSchema,
  meResponseSchema,
  publicConfigSchema,
  accountDetailsSchema,
  avatarUpdateSchema,
  phoneSchema,
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
    let phone: string | undefined;
    if (body.phone !== undefined) {
      const parsed = phoneSchema.safeParse(body.phone);
      if (!parsed.success) {
        throw new BadRequestException({
          message: 'Validation failed',
          details: [{ path: 'phone', message: parsed.error.issues[0]?.message ?? 'Enter a mobile number' }],
        });
      }
      phone = parsed.data;
    }
    return this.accounts.updateProfile(user.id, { fullName: body.fullName, ...(phone ? { phone } : {}) });
  }

  @Put('me/avatar')
  @UseGuards(AuthGuard)
  @ResponseSchema(meResponseSchema)
  updateAvatar(@CurrentUser() user: SessionUser, @Body({ schema: avatarUpdateSchema }) body: z.output<typeof avatarUpdateSchema>) {
    return this.accounts.updateAvatar(user.id, body.avatarFileId);
  }

  @Get('account')
  @UseGuards(AuthGuard)
  @ResponseSchema(accountDetailsSchema)
  details(@CurrentUser() user: SessionUser) {
    return this.accounts.details(user.id);
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
