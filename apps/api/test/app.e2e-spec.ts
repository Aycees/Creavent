import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { z } from 'zod';
import {
  createApiClient,
  errorResponseSchema,
  healthResponseSchema,
} from '@creavent/shared';
import { AppModule } from '../src/app.module.js';
import { ResponseSchema } from '../src/response-schema.decorator.js';
import { setupApp } from '../src/setup-app.js';

const echoSchema = z.object({ name: z.string().min(1), age: z.number().int() });

// Test-only routes that exercise validation and error handling.
@Controller('test')
class TestController {
  @Post('echo')
  echo(@Body({ schema: echoSchema }) body: z.infer<typeof echoSchema>) {
    return body;
  }

  @Get('boom')
  boom() {
    throw new Error('secret internal detail');
  }

  @Get('bad-response')
  @ResponseSchema(healthResponseSchema)
  badResponse() {
    return { status: 'broken' };
  }
}

async function createApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [TestController],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({
    logger: false,
  });
  setupApp(app);
  await app.init();
  return app;
}

describe('API conventions (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health returns 200 with the shared schema', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('sets security headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('a validation failure returns 400 in the error shape with field details', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/test/echo')
      .send({ name: '', age: 'old' });

    expect(res.status).toBe(400);
    const body = errorResponseSchema.parse(res.body);
    expect(body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
    });
    expect(body.details?.map((d) => d.path)).toEqual(['name', 'age']);
  });

  it('an unknown route returns 404 in the error shape', async () => {
    const res = await request(app.getHttpServer()).get('/api/nope');

    expect(res.status).toBe(404);
    expect(errorResponseSchema.parse(res.body)).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
    });
  });

  it('an unhandled error returns 500 without leaking details', async () => {
    const res = await request(app.getHttpServer()).get('/api/test/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
    expect(res.text).not.toContain('secret');
  });

  it('a response that breaks its schema returns 500', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/test/bad-response',
    );

    expect(res.status).toBe(500);
    expect(errorResponseSchema.parse(res.body).statusCode).toBe(500);
  });

  it('serves the docs UI at /api/docs and describes /api/health', async () => {
    const ui = await request(app.getHttpServer()).get('/api/docs');
    expect(ui.status).toBe(200);
    expect(ui.headers['content-type']).toContain('text/html');

    const doc = await request(app.getHttpServer()).get('/api/docs-json');
    expect(doc.body.paths['/api/health'].get.responses['200']).toBeDefined();
  });
});

describe('typed API client (e2e)', () => {
  it('calls GET /api/health on a running server', async () => {
    const app = await createApp();
    await app.listen(0);
    const client = createApiClient(await app.getUrl());

    const { data, response } = await client.GET('/api/health');
    await app.close();

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: 'ok' });
  });
});

describe('API conventions in production (e2e)', () => {
  const nodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = nodeEnv;
  });

  it('does not serve /api/docs', async () => {
    process.env.NODE_ENV = 'production';
    process.env.BETTER_AUTH_SECRET ??= 'test-secret-that-is-at-least-32-characters';
    const app = await createApp();

    const res = await request(app.getHttpServer()).get('/api/docs');
    await app.close();

    expect(res.status).toBe(404);
  });
});
