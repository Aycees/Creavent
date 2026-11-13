import type { PrismaClient } from '../generated/prisma/client.js';
import type { EmailSender } from './email-sender.js';
import { renderEmail } from './templates/render-email.js';

// Sends one outbox row. Runs in the worker for each send-email job. A failure
// is recorded and rethrown so pg-boss retries the job.
export async function deliverEmail(
  prisma: PrismaClient,
  sender: EmailSender,
  emailId: string,
) {
  const email = await prisma.emailNotification.findUnique({ where: { id: emailId } });
  if (!email || email.status === 'sent') return;

  try {
    const message = await renderEmail(email.type, email.payload);
    await sender.send({ to: email.toEmail, ...message });
  } catch (error) {
    await prisma.emailNotification.update({
      where: { id: emailId },
      data: { status: 'failed', error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }

  await prisma.emailNotification.update({
    where: { id: emailId },
    data: { status: 'sent', sentAt: new Date(), error: null },
  });
}
