import { Module } from '@nestjs/common';
import { HostApprovalService } from './host-approval.service.js';
import { PopupsController } from './popups.controller.js';
import { PopupsService } from './popups.service.js';

@Module({ controllers: [PopupsController], providers: [PopupsService, HostApprovalService] })
export class PopupsModule {}
