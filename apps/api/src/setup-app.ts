import {
  BadRequestException,
  INestApplication,
  StandardSchemaSerializerInterceptor,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
  type SchemaObject,
} from '@nestjs/swagger';
import { errorResponseSchema } from '@creavent/shared';
import { z } from 'zod';
import { toNodeHandler } from 'better-auth/node';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { AUTH, type Auth } from './auth/auth.js';

// Shared by main.ts, the e2e tests, and the OpenAPI script, so all three
// build the app the same way.
export function setupApp(app: INestApplication) {
  const isProduction = process.env.NODE_ENV === 'production';

  app.useSecurityHeaders();
  // Better Auth handles /api/auth/*. It reads the raw body, so it is mounted
  // before Nest's body parser, which is added when the app initializes.
  const authHandler = toNodeHandler(app.get<Auth>(AUTH));
  app.use((req: { url: string }, res: unknown, next: () => void) =>
    req.url.startsWith('/api/auth/') ? authHandler(req as never, res as never) : next(),
  );
  // Matches the web app's /api/* rewrite (docs/architecture.md §4.3).
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      exceptionFactory: (issues) =>
        new BadRequestException({
          message: 'Validation failed',
          details: issues.map((issue) => ({
            path: (issue.path ?? [])
              .map((s) => String(typeof s === 'object' ? s.key : s))
              .join('.'),
            message: issue.message,
          })),
        }),
    }),
  );
  app.useGlobalInterceptors(
    new StandardSchemaSerializerInterceptor(app.get(Reflector)),
  );
  app.useGlobalFilters(new ApiExceptionFilter(app.get(HttpAdapterHost)));

  if (!isProduction) {
    SwaggerModule.setup('docs', app, () => createOpenApiDocument(app), {
      useGlobalPrefix: true,
    });
  }
}

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Creavent API')
    .setVersion('0.0.1')
    // Converted here because Swagger deep-clones global responses, which
    // breaks a Zod schema passed as `standardSchema`.
    .addGlobalResponse({
      status: 'default',
      description: 'Error',
      schema: z.toJSONSchema(errorResponseSchema, {
        target: 'openapi-3.0',
      }) as SchemaObject,
    })
    .build();
  return SwaggerModule.createDocument(app, config);
}
