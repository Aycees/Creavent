import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import {
  adminEventSchema,
  adminEventsQuerySchema,
  adminEventsSchema,
  adminSearchQuerySchema,
  adminSearchSchema,
  adminUserSchema,
  adminUsersQuerySchema,
  adminUsersSchema,
  hideEventSchema,
  revokeHostSchema,
  roleTypeSchema,
  suspendRoleSchema,
  type RoleType,
} from '@creavent/shared';
import type { z } from 'zod';
import { AdminGuard } from '../auth/admin.guard.js';
import { CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { AdminEventsService } from './admin-events.service.js';
import { AdminSearchService } from './admin-search.service.js';
import { AdminUsersService } from './admin-users.service.js';

// Admin search, users and events (sitemap §6).
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly searchService: AdminSearchService,
    private readonly users: AdminUsersService,
    private readonly events: AdminEventsService,
  ) {}

  @Get('search')
  @ResponseSchema(adminSearchSchema)
  search(@Query({ schema: adminSearchQuerySchema }) query: z.output<typeof adminSearchQuerySchema>) {
    return this.searchService.search(query.q);
  }

  @Get('users')
  @ResponseSchema(adminUsersSchema)
  listUsers(@Query({ schema: adminUsersQuerySchema }) query: z.output<typeof adminUsersQuerySchema>) {
    return this.users.list(query);
  }

  @Get('users/:id')
  @ResponseSchema(adminUserSchema)
  user(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.detail(id);
  }

  @Post('users/:id/roles/:role/suspend')
  @HttpCode(200)
  @ResponseSchema(adminUserSchema)
  suspend(
    @CurrentUser() admin: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('role', { schema: roleTypeSchema }) role: RoleType,
    @Body({ schema: suspendRoleSchema }) body: z.output<typeof suspendRoleSchema>,
  ) {
    return this.users.suspend(admin.id, id, role, body.reason, body.hideUpcomingEvents);
  }

  @Post('users/:id/roles/:role/reinstate')
  @HttpCode(200)
  @ResponseSchema(adminUserSchema)
  reinstate(@CurrentUser() admin: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Param('role', { schema: roleTypeSchema }) role: RoleType) {
    return this.users.reinstate(admin.id, id, role);
  }

  @Post('users/:id/revoke-host')
  @HttpCode(200)
  @ResponseSchema(adminUserSchema)
  revokeHost(@CurrentUser() admin: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: revokeHostSchema }) body: z.output<typeof revokeHostSchema>) {
    return this.users.revokeHost(admin.id, id, body.reason);
  }

  @Get('events')
  @ResponseSchema(adminEventsSchema)
  listEvents(@Query({ schema: adminEventsQuerySchema }) query: z.output<typeof adminEventsQuerySchema>) {
    return this.events.list(query);
  }

  @Get('events/:id')
  @ResponseSchema(adminEventSchema)
  event(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.detail(id);
  }

  @Post('events/:id/hide')
  @HttpCode(200)
  @ResponseSchema(adminEventSchema)
  hide(@CurrentUser() admin: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: hideEventSchema }) body: z.output<typeof hideEventSchema>) {
    return this.events.hide(admin.id, id, body.reason);
  }

  @Post('events/:id/show')
  @HttpCode(200)
  @ResponseSchema(adminEventSchema)
  show(@CurrentUser() admin: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.show(admin.id, id);
  }
}
