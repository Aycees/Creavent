import { Module } from '@nestjs/common';
import { OrganizerApplicationsController } from './organizer-applications.controller.js';
import { OrganizerApplicationsService } from './organizer-applications.service.js';
import { OrganizerVendorsController } from './organizer-vendors.controller.js';
import { OrganizerVendorsService } from './organizer-vendors.service.js';
import { OrganizerAllApplicationsController } from './organizer-all-applications.controller.js';
import { OrganizerAllApplicationsService } from './organizer-all-applications.service.js';
import { PaymentsService } from './payments.service.js';
import { VendorApplicationsController } from './vendor-applications.controller.js';
import { VendorApplicationsService } from './vendor-applications.service.js';

@Module({
  controllers: [OrganizerAllApplicationsController, VendorApplicationsController, OrganizerApplicationsController, OrganizerVendorsController],
  providers: [OrganizerAllApplicationsService, VendorApplicationsService, OrganizerApplicationsService, OrganizerVendorsService, PaymentsService],
})
export class ApplicationsModule {}
