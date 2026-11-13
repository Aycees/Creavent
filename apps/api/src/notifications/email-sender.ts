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

// Without a Resend key in development, emails are written to the worker's log
// so their links can still be opened.
class LogEmailSender implements EmailSender {
  private readonly logger = new Logger('Email');

  async send(message: EmailMessage) {
    this.logger.log(`To ${message.to}: ${message.subject}\n${message.text}`);
  }
}

export function createEmailSender(): EmailSender {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    // Resend's test sender until the sending domain exists (open question E1).
    const from = process.env.EMAIL_FROM ?? 'Creavent <onboarding@resend.dev>';
    return new ResendEmailSender(apiKey, from);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('RESEND_API_KEY is required in production');
  }
  return new LogEmailSender();
}
