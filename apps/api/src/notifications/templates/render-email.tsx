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
  application_submitted: {
    payload: z.object({ name: z.string(), shopName: z.string(), eventName: z.string(), url: z.string(), supportEmail: z.string() }),
    subject: (p: { shopName: string; eventName: string }) => `New application: ${p.shopName} for ${p.eventName}`,
    body: (p: { name: string; shopName: string; eventName: string; url: string }) => (
      <>
        <Heading>New application</Heading>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>
          {p.shopName} applied to sell at {p.eventName}. Review their categories, documents, and contact number, then
          approve or decline.
        </Paragraph>
        <ActionButton href={p.url}>Review applications</ActionButton>
      </>
    ),
  },
  application_withdrawn: {
    payload: z.object({ name: z.string(), shopName: z.string(), eventName: z.string(), url: z.string(), supportEmail: z.string() }),
    subject: (p: { shopName: string; eventName: string }) => `${p.shopName} withdrew their application to ${p.eventName}`,
    body: (p: { name: string; shopName: string; eventName: string; url: string }) => (
      <>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>
          {p.shopName} withdrew their application to {p.eventName} before you decided on it. Nothing else changes. They
          can apply again later.
        </Paragraph>
        <ActionButton href={p.url}>See applications</ActionButton>
      </>
    ),
  },
  application_approved: {
    payload: z.object({ name: z.string(), eventName: z.string(), note: z.string().nullable(), url: z.string(), supportEmail: z.string() }),
    subject: (p: { eventName: string }) => `You're approved for ${p.eventName}`,
    body: (p: { name: string; eventName: string; note: string | null; url: string }) => (
      <>
        <Heading>You&apos;re approved</Heading>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>
          The organizer approved your application to {p.eventName}. Next, they assign you a slot. We&apos;ll email you the
          slot, the amount, and how to pay.
        </Paragraph>
        {p.note && <InfoBox label="Note from the organizer" lines={[p.note]} />}
        <ActionButton href={p.url}>See your application</ActionButton>
      </>
    ),
  },
  application_declined: {
    payload: z.object({ name: z.string(), eventName: z.string(), note: z.string().nullable(), url: z.string(), supportEmail: z.string() }),
    subject: (p: { eventName: string }) => `Your application to ${p.eventName}`,
    body: (p: { name: string; eventName: string; note: string | null; url: string }) => (
      <>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>The organizer of {p.eventName} declined your application this time.</Paragraph>
        {p.note && <InfoBox label="Note from the organizer" lines={[p.note]} />}
        <Paragraph>You can apply again while the event takes applications, or find other events open to vendors.</Paragraph>
        <ActionButton href={p.url}>See your application</ActionButton>
      </>
    ),
  },
  slot_assigned: {
    payload: z.object({
      name: z.string(),
      eventName: z.string(),
      slotLabel: z.string(),
      amount: z.string(),
      deadlineAt: z.string(),
      instructions: z.array(z.string()),
      url: z.string(),
      supportEmail: z.string(),
    }),
    subject: (p: { slotLabel: string; eventName: string }) => `Slot ${p.slotLabel} at ${p.eventName}: pay to confirm`,
    body: (p: { name: string; eventName: string; slotLabel: string; amount: string; deadlineAt: string; instructions: string[]; url: string }) => (
      <>
        <Heading>{`You got slot ${p.slotLabel}`}</Heading>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>
          The organizer of {p.eventName} assigned you slot {p.slotLabel}. Pay {p.amount} by {manila.format(new Date(p.deadlineAt))}{' '}
          (Philippine time), then upload a screenshot of your payment. Your slot is reserved once the organizer approves it.
        </Paragraph>
        {p.instructions.length > 0 && <InfoBox label="Pay the organizer with" lines={p.instructions} />}
        <ActionButton href={p.url}>Pay and upload proof</ActionButton>
        <Note last>
          Creavent doesn&apos;t hold or guarantee payments. Check that the organizer is &quot;Approved by Creavent&quot; before you pay.
        </Note>
      </>
    ),
  },
} satisfies Record<NotificationType, unknown>;

export async function renderEmail(type: NotificationType, payload: unknown) {
  const template = templates[type];
  const data = template.payload.parse(payload);
  // Some subjects name the shop or event, from the same payload.
  const subject = (template.subject as (p: typeof data) => string)(data);
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
