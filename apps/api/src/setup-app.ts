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
import { ApiExceptionFilter } from './api-exception.filter.js';

// Shared by main.ts, the e2e tests, and the OpenAPI script, so all three
// build the app the same way.
export function setupApp(app: INestApplication) {
  const isProduction = process.env.NODE_ENV === 'production';

  app.useSecurityHeaders();
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
