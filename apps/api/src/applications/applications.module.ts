import { Module } from '@nestjs/common';
import { VendorApplicationsController } from './vendor-applications.controller.js';
import { VendorApplicationsService } from './vendor-applications.service.js';

@Module({
  controllers: [VendorApplicationsController],
  providers: [VendorApplicationsService],
})
export class ApplicationsModule {}
