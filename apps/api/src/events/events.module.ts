import { Module } from '@nestjs/common';
import { OrganizerEventsController } from './organizer-events.controller.js';
import { OrganizerEventsService } from './organizer-events.service.js';

@Module({ controllers: [OrganizerEventsController], providers: [OrganizerEventsService] })
export class EventsModule {}
