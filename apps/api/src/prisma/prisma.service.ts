import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

// One Prisma client for the app. It connects on the first query, so the app
// can start (and build its OpenAPI document) without a database.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

// A transaction client, for helpers that must run inside the caller's
// transaction (outbox rows, audit logs).
export type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];
