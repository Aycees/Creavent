import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './setup-app.js';

async function bootstrap() {
  // Buffered until setupApp() installs the app's logger.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  setupApp(app);
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
