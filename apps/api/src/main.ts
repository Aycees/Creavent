import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Matches the web app's /api/* rewrite (docs/architecture.md §4.3).
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
