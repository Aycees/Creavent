import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, type SessionUser } from './auth.guard.js';

// Admin endpoints (architecture §4.4). Admins are set by the team in the
// database, never through signup.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthGuard) {}

  async canActivate(context: ExecutionContext) {
    await this.auth.canActivate(context);
    const user = context.switchToHttp().getRequest<Request & { user: SessionUser }>().user;
    if (!user.isAdmin) throw new ForbiddenException('Admins only');
    return true;
  }
}
