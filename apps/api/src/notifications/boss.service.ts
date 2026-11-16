import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PgBoss } from 'pg-boss';

export const SEND_EMAIL_QUEUE = 'send-email';
// Hourly: announced events that have ended become completed (architecture §6.1).
export const COMPLETE_EVENTS_QUEUE = 'complete-events';
// Daily: payment records and documents past retention (spec §6.7).
export const RETENTION_QUEUE = 'retention';
// Daily: removed files and uploads that never completed (spec §11.7).
export const CLEANUP_FILES_QUEUE = 'cleanup-files';
// Nightly: pg_dump to the backups bucket (architecture §9.3).
export const BACKUP_QUEUE = 'backup-database';

// pg-boss keeps its jobs in Postgres (docs/architecture.md §6.1). It starts on
// first use, so the API can boot without a database.
@Injectable()
export class BossService implements OnModuleDestroy {
  private started?: Promise<PgBoss>;

  constructor(
    private readonly connectionString = process.env.DATABASE_URL,
  ) {}

  get(): Promise<PgBoss> {
    this.started ??= this.start();
    return this.started;
  }

  private async start() {
    const boss = new PgBoss({ connectionString: this.connectionString });
    boss.on('error', (error) => console.error('pg-boss', error));
    await boss.start();
    await boss.createQueue(SEND_EMAIL_QUEUE, {
      retryLimit: 5,
      retryDelay: 30,
      retryBackoff: true,
    });
    await boss.createQueue(COMPLETE_EVENTS_QUEUE);
    await boss.createQueue(RETENTION_QUEUE);
    await boss.createQueue(CLEANUP_FILES_QUEUE);
    await boss.createQueue(BACKUP_QUEUE, { retryLimit: 2, retryDelay: 600 });
    return boss;
  }

  async onModuleDestroy() {
    if (this.started) await (await this.started).stop({ graceful: false });
  }
}
