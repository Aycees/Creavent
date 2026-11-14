import { Global, Module } from '@nestjs/common';
import { BossService } from './boss.service.js';
import { OutboxService } from './outbox.service.js';

@Global()
@Module({
  providers: [{ provide: BossService, useFactory: () => new BossService() }, OutboxService],
  exports: [BossService, OutboxService],
})
export class NotificationsModule {}
