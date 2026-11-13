import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './setup-app.js';

async function bootstrap() {
  // JSON lines in production, readable text in development. Set here rather
  // than in setupApp() so tests can turn logging off.
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: process.env.NODE_ENV === 'production' }),
  });
  setupApp(app);
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
