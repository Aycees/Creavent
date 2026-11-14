import { Module } from '@nestjs/common';
import { OptionalAuthGuard } from '../auth/auth.guard.js';
import { EventSlotsService } from './event-slots.service.js';
import { OrganizerEventsController } from './organizer-events.controller.js';
import { OrganizerEventsService } from './organizer-events.service.js';
import { VendorEventsController } from './vendor-events.controller.js';
import { VendorEventsService } from './vendor-events.service.js';

@Module({
  controllers: [OrganizerEventsController, VendorEventsController],
  providers: [OrganizerEventsService, EventSlotsService, VendorEventsService, OptionalAuthGuard],
})
export class EventsModule {}
