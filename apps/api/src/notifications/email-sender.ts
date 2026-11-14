import { Logger } from '@nestjs/common';
import { Resend } from 'resend';

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

class ResendEmailSender implements EmailSender {
  private readonly resend: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  async send(message: EmailMessage) {
    const { error } = await this.resend.emails.send({ from: this.from, ...message });
    if (error) throw new Error(`Resend: ${error.message}`);
  }
}

// Only when EMAIL_DRIVER=log is set (local development without a Resend key):
// emails go to the worker's log so their links can still be opened. Never
// chosen by default, because the log would hold sign-in links.
class LogEmailSender implements EmailSender {
  private readonly logger = new Logger('Email');

  async send(message: EmailMessage) {
    this.logger.log(`To ${message.to}: ${message.subject}\n${message.text}`);
  }
}

export function createEmailSender(): EmailSender {
  if (process.env.EMAIL_DRIVER === 'log') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('EMAIL_DRIVER=log is not allowed in production');
    }
    return new LogEmailSender();
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Set RESEND_API_KEY, or EMAIL_DRIVER=log for local development');
  }
  // Resend's test sender until the sending domain exists (open question E1).
  const from = process.env.EMAIL_FROM ?? 'Creavent <onboarding@resend.dev>';
  return new ResendEmailSender(apiKey, from);
}
