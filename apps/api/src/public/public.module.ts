import { Global, Module } from '@nestjs/common';
import { PublicController } from './public.controller.js';
import { PublicPagesService } from './public-pages.service.js';
import { PublicRefreshService } from './public-refresh.service.js';

// Global, since many changes elsewhere refresh public pages (decision Q1).
@Global()
@Module({
  controllers: [PublicController],
  providers: [PublicPagesService, PublicRefreshService],
  exports: [PublicPagesService, PublicRefreshService],
})
export class PublicModule {}
