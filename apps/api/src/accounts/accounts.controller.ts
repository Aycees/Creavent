import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  acceptLegalSchema,
  legalVersionsSchema,
  meResponseSchema,
  type AcceptLegalInput,
  type LegalVersions,
} from '@creavent/shared';
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

  // The current versions and values the signup and legal pages show.
  @Get('legal')
  @ResponseSchema(legalVersionsSchema)
  legal(): LegalVersions {
    const { termsVersion, privacyVersion, minimumAge, supportEmail } = appConfig();
    return { termsVersion, privacyVersion, minimumAge, supportEmail };
  }
}
