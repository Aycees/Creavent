// The worker service: runs jobs only, never serves HTTP (docs/architecture.md §1).
import { ConsoleLogger, Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BossService, SEND_EMAIL_QUEUE } from './notifications/boss.service.js';
import { deliverEmail } from './notifications/deliver-email.js';
import { createEmailSender } from './notifications/email-sender.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaService } from './prisma/prisma.service.js';

@Module({ imports: [PrismaModule, NotificationsModule] })
class WorkerModule {}

const app = await NestFactory.createApplicationContext(WorkerModule, {
  logger: new ConsoleLogger({ json: process.env.NODE_ENV === 'production' }),
});
app.enableShutdownHooks();

const prisma = app.get(PrismaService);
const sender = createEmailSender();
const boss = await app.get(BossService).get();

await boss.work<{ emailId: string }>(SEND_EMAIL_QUEUE, async ([job]) => {
  await deliverEmail(prisma, sender, job.data.emailId);
});

new Logger('Worker').log('Worker started');
