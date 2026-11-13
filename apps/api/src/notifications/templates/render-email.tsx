import { render } from 'react-email';
import { z } from 'zod';
import type { NotificationType } from '../../generated/prisma/client.js';
import { ActionButton, EmailLayout, Paragraph } from './layout.js';

// One template per notification type (spec §8.1). Each validates the payload
// the outbox row was written with.
const templates = {
  email_verification: {
    payload: z.object({ name: z.string(), url: z.string(), supportEmail: z.string() }),
    subject: () => 'Confirm your email',
    body: (p: { name: string; url: string }) => (
      <>
        <Paragraph>Hi {p.name},</Paragraph>
        <Paragraph>Confirm your email to finish setting up your Creavent account. The link works for 24 hours.</Paragraph>
        <ActionButton href={p.url}>Confirm email</ActionButton>
        <Paragraph>{' '}</Paragraph>
        <Paragraph>If you didn't sign up for Creavent, you can ignore this email.</Paragraph>
      </>
    ),
  },
  password_reset: {
    payload: z.object({ name: z.string(), url: z.string(), supportEmail: z.string() }),
    subject: () => 'Reset your password',
    body: (p: { name: string; url: string }) => (
      <>
        <Paragraph>Hi {p.name},</Paragraph>
        <Paragraph>Someone asked to reset the password for your Creavent account. The link works for 1 hour.</Paragraph>
        <ActionButton href={p.url}>Set a new password</ActionButton>
        <Paragraph>{' '}</Paragraph>
        <Paragraph>If it wasn't you, ignore this email. Your password stays the same.</Paragraph>
      </>
    ),
  },
  organizer_approved: {
    payload: z.object({ name: z.string(), displayName: z.string(), url: z.string(), supportEmail: z.string() }),
    subject: () => "You're approved by Creavent",
    body: (p: { name: string; displayName: string; url: string }) => (
      <>
        <Paragraph>Hi {p.name},</Paragraph>
        <Paragraph>
          We reviewed {p.displayName}'s public pages and approved your organizer account. Your organizer page and events
          now show "Approved by Creavent", and you can open events to vendors.
        </Paragraph>
        <ActionButton href={p.url}>Go to your dashboard</ActionButton>
      </>
    ),
  },
  organizer_rejected: {
    payload: z.object({ name: z.string(), reason: z.string(), url: z.string(), supportEmail: z.string() }),
    subject: () => 'Your organizer approval needs changes',
    body: (p: { name: string; reason: string; url: string; supportEmail: string }) => (
      <>
        <Paragraph>Hi {p.name},</Paragraph>
        <Paragraph>We couldn't approve your organizer account yet. Here's why:</Paragraph>
        <Paragraph>{p.reason}</Paragraph>
        <Paragraph>
          You can update your links and submit again. You can keep working on draft events in the meantime. If you think
          this is a mistake, email {p.supportEmail}.
        </Paragraph>
        <ActionButton href={p.url}>Update and resubmit</ActionButton>
      </>
    ),
  },
} satisfies Record<NotificationType, unknown>;

export async function renderEmail(type: NotificationType, payload: unknown) {
  const template = templates[type];
  const data = template.payload.parse(payload);
  const subject = template.subject();
  // Each body takes its own payload shape, which parse() above guarantees.
  const body = (template.body as (p: typeof data) => React.ReactNode)(data);
  const element = (
    <EmailLayout preview={subject} supportEmail={data.supportEmail}>
      {body}
    </EmailLayout>
  );
  return {
    subject,
    html: await render(element),
    text: await render(element, { plainText: true }),
  };
}
