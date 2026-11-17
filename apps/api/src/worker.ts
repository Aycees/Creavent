// The worker service: runs jobs only, never serves HTTP (docs/architecture.md §1).
import { ConsoleLogger, Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { completeEndedEvents } from './events/complete-events.js';
import { R2Storage } from './files/storage.js';
import { backupDatabase, createR2BackupStore } from './jobs/backup.js';
import { cleanUpFiles } from './jobs/cleanup.js';
import { purgeExpiredPaymentRecords } from './jobs/retention.js';
import { BACKUP_QUEUE, BossService, CLEANUP_FILES_QUEUE, COMPLETE_EVENTS_QUEUE, RETENTION_QUEUE, SEND_EMAIL_QUEUE } from './notifications/boss.service.js';
import { deliverEmail } from './notifications/deliver-email.js';
import { createEmailSender } from './notifications/email-sender.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { PublicRefreshService } from './public/public-refresh.service.js';

@Module({ imports: [PrismaModule, NotificationsModule] })
class WorkerModule {}

const app = await NestFactory.createApplicationContext(WorkerModule, {
  logger: new ConsoleLogger({ json: process.env.NODE_ENV === 'production' }),
});
app.enableShutdownHooks();

const prisma = app.get(PrismaService);
const sender = createEmailSender();
const refresh = new PublicRefreshService();
const boss = await app.get(BossService).get();

await boss.work<{ emailId: string }>(SEND_EMAIL_QUEUE, async ([job]) => {
  await deliverEmail(prisma, sender, job.data.emailId);
});

await boss.schedule(COMPLETE_EVENTS_QUEUE, '0 * * * *');
await boss.work(COMPLETE_EVENTS_QUEUE, async () => {
  const changed = await completeEndedEvents(prisma);
  if (changed.length) {
    new Logger('CompleteEvents').log(`Marked ${changed.length - 1} ended events completed`);
    await refresh.refresh(changed);
  }
});

// Daily, at night in the Philippines (architecture §6.1).
const storage = new R2Storage();
await boss.schedule(RETENTION_QUEUE, '0 3 * * *', null, { tz: 'Asia/Manila' });
await boss.work(RETENTION_QUEUE, async () => {
  const purged = await purgeExpiredPaymentRecords(prisma);
  if (purged) new Logger('Retention').log(`Purged payment records of ${purged} events`);
});
await boss.schedule(CLEANUP_FILES_QUEUE, '30 3 * * *', null, { tz: 'Asia/Manila' });
await boss.work(CLEANUP_FILES_QUEUE, async () => {
  const result = await cleanUpFiles(prisma, storage);
  new Logger('CleanUpFiles').log(`Deleted ${result.deleted} removed files and ${result.abandoned} unfinished uploads, kept ${result.kept}`);
});

// Nightly backup, where a backups bucket is set (staging and production).
if (process.env.R2_BACKUPS_BUCKET && process.env.DATABASE_URL) {
  const databaseUrl = process.env.DATABASE_URL;
  const backups = createR2BackupStore();
  await boss.schedule(BACKUP_QUEUE, '0 2 * * *', null, { tz: 'Asia/Manila' });
  await boss.work(BACKUP_QUEUE, async () => {
    const key = await backupDatabase(backups, { databaseUrl });
    new Logger('Backup').log(`Saved ${key}`);
  });
} else {
  await boss.unschedule(BACKUP_QUEUE);
  new Logger('Backup').warn('R2_BACKUPS_BUCKET is not set, so the nightly backup is off');
}

new Logger('Worker').log('Worker started');
