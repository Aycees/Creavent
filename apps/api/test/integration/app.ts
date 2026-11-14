import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { inject } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { STORAGE } from '../../src/files/storage.js';
import { TEST_PASSWORD } from './factories.js';
import { MemoryStorage } from './memory-storage.js';
import { setupApp } from '../../src/setup-app.js';

let clientIp = '';
let signIns = 0;
let ipCounter = 0;

// The whole API against the run's test database, as the web app reaches it.
// Each app gets its own client IP: Better Auth's rate limits are kept in
// memory per process, so tests would otherwise share them.
export async function createTestApp(
  storage = new MemoryStorage(),
): Promise<INestApplication<App>> {
  ipCounter += 1;
  // Public addresses (TEST-NET-3): private ones are trusted proxies.
  clientIp = `203.0.113.${ipCounter % 250}`;
  process.env.DATABASE_URL = inject('databaseUrl');
  process.env.BETTER_AUTH_SECRET ??= 'test-secret-that-is-at-least-32-characters';
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(STORAGE)
    .useValue(storage)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
  setupApp(app);
  await app.init();
  return app;
}

// Requests from the web app's origin, which Better Auth checks.
export const ORIGIN = 'http://localhost:3000';

// A signed-in browser for an existing user (made with the factories).
export async function signInAs(app: INestApplication<App>, email: string) {
  const browser = agent(app);
  // Its own address, so tests that sign in many users stay under the per-IP limit.
  signIns += 1;
  const res = await browser
    .post('/api/auth/sign-in/email')
    .set('X-Forwarded-For', `198.18.${Math.floor(signIns / 250)}.${signIns % 250}`)
    .send({ email, password: TEST_PASSWORD });
  if (res.status !== 200) throw new Error(`sign-in failed: ${res.status} ${res.text}`);
  return browser;
}

export function agent(app: INestApplication<App>) {
  return request
    .agent(app.getHttpServer())
    .set('Origin', ORIGIN)
    .set('X-Forwarded-For', clientIp);
}
