// Writes the OpenAPI document to apps/api/openapi.json without starting a
// server or connecting to a database. Run with `pnpm generate:api` from the
// repo root, which also regenerates the typed client in packages/shared.
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module.js';
import { createOpenApiDocument, setupApp } from './setup-app.js';

const app = await NestFactory.create(AppModule, { logger: false });
setupApp(app);
const document = createOpenApiDocument(app);
const file = resolve(import.meta.dirname, '../openapi.json');
writeFileSync(file, JSON.stringify(document, null, 2) + '\n');
await app.close();
