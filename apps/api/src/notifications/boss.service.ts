import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PgBoss } from 'pg-boss';

export const SEND_EMAIL_QUEUE = 'send-email';

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
    return boss;
  }

  async onModuleDestroy() {
    if (this.started) await (await this.started).stop({ graceful: false });
  }
}
