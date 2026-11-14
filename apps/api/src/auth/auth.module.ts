import { Global, Module } from '@nestjs/common';
import { appConfig } from '../config.js';
import { OutboxService } from '../notifications/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUTH, createAuth } from './auth.js';
import { AuthGuard } from './auth.guard.js';


@Global()
@Module({
  providers: [
    {
      provide: AUTH,
      inject: [PrismaService, OutboxService],
      useFactory: (prisma: PrismaService, outbox: OutboxService) =>
        createAuth(prisma, outbox, appConfig()),
    },
    AuthGuard,
  ],
  exports: [AUTH, AuthGuard],
})
export class AuthModule {}
