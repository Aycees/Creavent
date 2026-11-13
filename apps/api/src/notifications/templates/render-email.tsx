import { render } from 'react-email';
import { z } from 'zod';
import type { NotificationType } from '../../generated/prisma/client.js';
import { ActionButton, CopyLink, Divider, EmailLayout, Heading, InfoBox, Note, Paragraph } from './layout.js';

// "Hi Maria": the first name only, as in the mockup.
const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'there';

const manila = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  dateStyle: 'medium',
  timeStyle: 'short',
});

// One template per notification type (spec §8.1). Each validates the payload
// the outbox row was written with.
const templates = {
  email_verification: {
    payload: z.object({ name: z.string(), url: z.string(), supportEmail: z.string() }),
    subject: () => 'Confirm your email',
    preview: () => 'Confirm your email to finish setting up Creavent. The link works for 24 hours.',
    body: (p: { name: string; url: string }) => (
      <>
        <Heading>Confirm your email</Heading>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>
          Confirm your email to finish setting up your Creavent account. Once it&apos;s confirmed you can apply for vendor
          slots and get updates about your events.
        </Paragraph>
        <ActionButton href={p.url}>Confirm email</ActionButton>
        <Note>This link expires in 24 hours. If it does, log in and we&apos;ll send a new one.</Note>
        <Divider />
        <CopyLink href={p.url} />
        <Note last>Didn&apos;t sign up for Creavent? You can ignore this email. Nothing happens unless you confirm.</Note>
      </>
    ),
  },
  email_change_confirmation: {
    payload: z.object({ name: z.string(), newEmail: z.string(), url: z.string(), supportEmail: z.string() }),
    subject: () => 'Approve your new email address',
    body: (p: { name: string; newEmail: string; url: string; supportEmail: string }) => (
      <>
        <Paragraph>Hi {p.name},</Paragraph>
        <Paragraph>
          Someone asked to change your Creavent email to {p.newEmail}. If it was you, approve it, and we&apos;ll send a
          link to the new address to finish.
        </Paragraph>
        <ActionButton href={p.url}>Approve the change</ActionButton>
        <Paragraph>{' '}</Paragraph>
        <Paragraph>If it wasn&apos;t you, ignore this email and change your password. Your email stays the same.</Paragraph>
      </>
    ),
  },
  password_reset: {
    payload: z.object({
      name: z.string(),
      url: z.string(),
      supportEmail: z.string(),
      // When and from what the reset was asked for, if known.
      requestedAt: z.string().optional(),
      device: z.string().optional(),
    }),
    subject: () => 'Reset your Creavent password',
    preview: () => 'Use this link to set a new password. It expires in 1 hour.',
    body: (p: { name: string; url: string; requestedAt?: string; device?: string }) => {
      const details = [
        ...(p.requestedAt ? [`${manila.format(new Date(p.requestedAt))} (Philippine time)`] : []),
        ...(p.device ? [p.device] : []),
      ];
      return (
        <>
          <Heading>Reset your password</Heading>
          <Paragraph>Hi {firstName(p.name)},</Paragraph>
          <Paragraph>
            We got a request to reset the password for your Creavent account. Use the button below to choose a new one.
          </Paragraph>
          <ActionButton href={p.url}>Set a new password</ActionButton>
          <Note>
            This link expires in 1 hour and works once. Setting a new password logs you out on your other devices.
          </Note>
          {details.length > 0 && <InfoBox label="Request details" lines={details} />}
          <Divider />
          <CopyLink href={p.url} />
          <Note last>
            Didn&apos;t ask for this? Ignore this email, and your password stays the same. If you keep getting these, write to
            support.
          </Note>
        </>
      );
    },
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
  const preview = 'preview' in template ? template.preview() : subject;
  // Each body takes its own payload shape, which parse() above guarantees.
  const body = (template.body as (p: typeof data) => React.ReactNode)(data);
  const element = (
    <EmailLayout preview={preview} supportEmail={data.supportEmail} siteHost={new URL(data.url).host}>
      {body}
    </EmailLayout>
  );
  return {
    subject,
    html: await render(element),
    text: await render(element, { plainText: true }),
  };
}
