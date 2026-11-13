import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { AUTH, type Auth } from './auth.js';

export type SessionUser = { id: string; email: string; isAdmin: boolean };

// Signed-in users only. The session is checked in Postgres on every request,
// so a signed-out or deleted session loses access at once (architecture §4.3).
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session || session.user.deletedAt) throw new UnauthorizedException('Sign in to continue');
    req.user = {
      id: session.user.id,
      email: session.user.email,
      isAdmin: session.user.isAdmin === true,
    };
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser =>
    context.switchToHttp().getRequest<Request & { user: SessionUser }>().user,
);
