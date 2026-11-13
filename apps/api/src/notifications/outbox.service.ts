import { Injectable } from '@nestjs/common';
import { fromPrisma } from 'pg-boss';
import type { NotificationType, Prisma } from '../generated/prisma/client.js';
import type { Tx } from '../prisma/prisma.service.js';
import { BossService, SEND_EMAIL_QUEUE } from './boss.service.js';

export type QueueEmailInput = {
  userId?: string;
  toEmail: string;
  type: NotificationType;
  payload: Prisma.InputJsonObject;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

// Code never calls the email provider during a request. It writes an outbox
// row and a send job in the transaction of the change that caused the email
// (docs/architecture.md §6.2).
@Injectable()
export class OutboxService {
  constructor(private readonly boss: BossService) {}

  async queue(tx: Tx, input: QueueEmailInput) {
    const email = await tx.emailNotification.create({ data: input });
    const boss = await this.boss.get();
    await boss.send(
      SEND_EMAIL_QUEUE,
      { emailId: email.id },
      { db: fromPrisma(tx) },
    );
    return email;
  }
}
