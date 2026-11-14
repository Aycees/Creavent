import { Module } from '@nestjs/common';
import { EventSlotsService } from './event-slots.service.js';
import { OrganizerEventsController } from './organizer-events.controller.js';
import { OrganizerEventsService } from './organizer-events.service.js';

@Module({ controllers: [OrganizerEventsController], providers: [OrganizerEventsService, EventSlotsService] })
export class EventsModule {}
