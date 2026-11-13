import { inject } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { BossService, SEND_EMAIL_QUEUE } from '../../src/notifications/boss.service.js';
import { deliverEmail } from '../../src/notifications/deliver-email.js';
import type { EmailSender } from '../../src/notifications/email-sender.js';
import { OutboxService } from '../../src/notifications/outbox.service.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createUser } from './factories.js';

// The email outbox (docs/architecture.md §6.2): a row and a job are written
// in the caller's transaction, and the worker sends it later.
describe('email outbox', () => {
  let prisma: PrismaClient;
  let boss: BossService;
  let outbox: OutboxService;

  beforeAll(() => {
    prisma = createTestPrisma();
    boss = new BossService(inject('databaseUrl'));
    outbox = new OutboxService(boss);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await (await boss.get()).deleteAllJobs(SEND_EMAIL_QUEUE);
  });

  afterAll(async () => {
    await boss.onModuleDestroy();
    await prisma.$disconnect();
  });

  async function queueVerification(userId: string) {
    return prisma.$transaction((tx) =>
      outbox.queue(tx, {
        userId,
        toEmail: 'maria@example.com',
        type: 'email_verification',
        payload: { name: 'Maria', url: 'http://localhost:3000/verify?token=abc', supportEmail: 'support@creavent.example' },
      }),
    );
  }

  it('writes a queued row and a send job in the same transaction', async () => {
    const user = await createUser(prisma);

    const email = await queueVerification(user.id);

    expect(email.status).toBe('queued');
    const [job] = await (await boss.get()).fetch<{ emailId: string }>(SEND_EMAIL_QUEUE);
    expect(job.data.emailId).toBe(email.id);
  });

  it('leaves no row and no job when the transaction rolls back', async () => {
    const user = await createUser(prisma);

    await expect(
      prisma.$transaction(async (tx) => {
        await outbox.queue(tx, {
          userId: user.id,
          toEmail: 'maria@example.com',
          type: 'email_verification',
          payload: { name: 'Maria', url: 'http://x', supportEmail: 'support@creavent.example' },
        });
        throw new Error('the change failed');
      }),
    ).rejects.toThrow('the change failed');

    expect(await prisma.emailNotification.count()).toBe(0);
    expect(await (await boss.get()).fetch(SEND_EMAIL_QUEUE)).toEqual([]);
  });

  it('sends a queued email and marks it sent', async () => {
    const user = await createUser(prisma);
    const email = await queueVerification(user.id);
    const sender: EmailSender = { send: vi.fn().mockResolvedValue(undefined) };

    await deliverEmail(prisma, sender, email.id);

    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'maria@example.com',
        subject: 'Confirm your email',
        text: expect.stringContaining('http://localhost:3000/verify?token=abc'),
      }),
    );
    const row = await prisma.emailNotification.findUniqueOrThrow({ where: { id: email.id } });
    expect(row.status).toBe('sent');
    expect(row.sentAt).not.toBeNull();
  });

  it('marks the email failed with the error and rethrows, so the job retries', async () => {
    const user = await createUser(prisma);
    const email = await queueVerification(user.id);
    const sender: EmailSender = { send: vi.fn().mockRejectedValue(new Error('Resend is down')) };

    await expect(deliverEmail(prisma, sender, email.id)).rejects.toThrow('Resend is down');

    const row = await prisma.emailNotification.findUniqueOrThrow({ where: { id: email.id } });
    expect(row.status).toBe('failed');
    expect(row.error).toBe('Resend is down');
  });

  it('does not send an email twice', async () => {
    const user = await createUser(prisma);
    const email = await queueVerification(user.id);
    const sender: EmailSender = { send: vi.fn().mockResolvedValue(undefined) };

    await deliverEmail(prisma, sender, email.id);
    await deliverEmail(prisma, sender, email.id);

    expect(sender.send).toHaveBeenCalledTimes(1);
  });
});
