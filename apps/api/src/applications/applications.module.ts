import { Module } from '@nestjs/common';
import { OrganizerApplicationsController } from './organizer-applications.controller.js';
import { OrganizerApplicationsService } from './organizer-applications.service.js';
import { VendorApplicationsController } from './vendor-applications.controller.js';
import { VendorApplicationsService } from './vendor-applications.service.js';

@Module({
  controllers: [VendorApplicationsController, OrganizerApplicationsController],
  providers: [VendorApplicationsService, OrganizerApplicationsService],
})
export class ApplicationsModule {}
