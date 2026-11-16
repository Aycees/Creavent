import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { adminSearchQuerySchema, adminSearchSchema } from '@creavent/shared';
import type { z } from 'zod';
import { AdminGuard } from '../auth/admin.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { AdminSearchService } from './admin-search.service.js';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly searchService: AdminSearchService) {}

  @Get('search')
  @ResponseSchema(adminSearchSchema)
  search(@Query({ schema: adminSearchQuerySchema }) query: z.output<typeof adminSearchQuerySchema>) {
    return this.searchService.search(query.q);
  }
}
