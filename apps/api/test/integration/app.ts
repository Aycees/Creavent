import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { inject } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/setup-app.js';

let clientIp = '';
let ipCounter = 0;

// The whole API against the run's test database, as the web app reaches it.
// Each app gets its own client IP: Better Auth's rate limits are kept in
// memory per process, so tests would otherwise share them.
export async function createTestApp(): Promise<INestApplication<App>> {
  ipCounter += 1;
  // Public addresses (TEST-NET-3): private ones are trusted proxies.
  clientIp = `203.0.113.${ipCounter % 250}`;
  process.env.DATABASE_URL = inject('databaseUrl');
  process.env.BETTER_AUTH_SECRET ??= 'test-secret-that-is-at-least-32-characters';
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
  setupApp(app);
  await app.init();
  return app;
}

// Requests from the web app's origin, which Better Auth checks.
export const ORIGIN = 'http://localhost:3000';

export function agent(app: INestApplication<App>) {
  return request
    .agent(app.getHttpServer())
    .set('Origin', ORIGIN)
    .set('X-Forwarded-For', clientIp);
}
