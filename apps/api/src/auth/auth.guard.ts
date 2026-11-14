import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { appConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUTH, type Auth } from './auth.js';
import { needsLegal } from './legal.js';

const ALLOW_PENDING_LEGAL = 'allowPendingLegal';

// Routes a user can call before accepting the current terms and confirming
// their age: reading who they are, and accepting (spec §1).
export const AllowPendingLegal = () => SetMetadata(ALLOW_PENDING_LEGAL, true);

export type SessionUser = { id: string; email: string; isAdmin: boolean };

// Signed-in users only. The session is checked in Postgres on every request,
// so a signed-out or deleted session loses access at once (architecture §4.3).
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session || session.user.deletedAt) throw new UnauthorizedException('Sign in to continue');
    req.user = {
      id: session.user.id,
      email: session.user.email,
      isAdmin: session.user.isAdmin === true,
    };
    // Users who must accept the current terms or confirm their age can do
    // nothing else until they do (spec §1). The web app sends them to
    // /account/legal; this makes the API hold to it too.
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_LEGAL, [context.getHandler(), context.getClass()]);
    if (!allowed && (await needsLegal(this.prisma, session.user.id, appConfig()))) {
      throw new ForbiddenException('Accept the current terms of use and privacy notice first');
    }
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser =>
    context.switchToHttp().getRequest<Request & { user: SessionUser }>().user,
);

// Pages anyone can open, that show more to signed-in users (the event page).
// Sets the user when the session is valid, and carries on without one.
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthGuard) {}

  async canActivate(context: ExecutionContext) {
    try {
      await this.auth.canActivate(context);
    } catch (error) {
      if (!(error instanceof UnauthorizedException || error instanceof ForbiddenException)) throw error;
      context.switchToHttp().getRequest<Request & { user?: SessionUser }>().user = undefined;
    }
    return true;
  }
}

export const OptionalUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser | undefined =>
    context.switchToHttp().getRequest<Request & { user?: SessionUser }>().user,
);
