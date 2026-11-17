import { slotWords } from '@creavent/shared';
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
  // Pop-up host approval (spec §4.7). The reviewed route only: an earned
  // approval sends nothing.
  host_approved: {
    payload: z.object({ name: z.string(), shopName: z.string(), url: z.string(), supportEmail: z.string() }),
    subject: () => "You're approved to host pop-ups",
    body: (p: { name: string; shopName: string; url: string }) => (
      <>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>
          We reviewed {p.shopName}'s pages and approved you to host pop-ups. Your pop-ups show "Approved by Creavent", and
          you can announce them to the event listing.
        </Paragraph>
        <ActionButton href={p.url}>Go to your pop-ups</ActionButton>
      </>
    ),
  },
  host_rejected: {
    payload: z.object({ name: z.string(), reason: z.string(), url: z.string(), supportEmail: z.string() }),
    subject: () => 'Your pop-up host request needs changes',
    body: (p: { name: string; reason: string; url: string; supportEmail: string }) => (
      <>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>We couldn't approve you to host pop-ups yet. Here's why:</Paragraph>
        <Paragraph>{p.reason}</Paragraph>
        <Paragraph>
          You can add a link and submit again. Your pop-up drafts stay as they are. If you think this is a mistake, email{' '}
          {p.supportEmail}.
        </Paragraph>
        <ActionButton href={p.url}>Update and resubmit</ActionButton>
      </>
    ),
  },
  host_approval_revoked: {
    payload: z.object({ name: z.string(), reason: z.string(), url: z.string(), supportEmail: z.string() }),
    subject: () => 'Your pop-up host approval was revoked',
    body: (p: { name: string; reason: string; url: string; supportEmail: string }) => (
      <>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>The Creavent team revoked your approval to host pop-ups, and hid your announced pop-ups.</Paragraph>
        <InfoBox label="Why" lines={[p.reason]} />
        <Paragraph>
          You can still apply to and sell at other events. To host again, submit your pages for review. If you think this is
          a mistake, reply to this email or write to {p.supportEmail}.
        </Paragraph>
        <ActionButton href={p.url}>See your host approval</ActionButton>
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
    subject: (p: { slotLabel: string; eventName: string }) => `${slotWords(p.slotLabel, true)} at ${p.eventName}: pay to confirm`,
    body: (p: { name: string; eventName: string; slotLabel: string; amount: string; deadlineAt: string; instructions: string[]; url: string }) => (
      <>
        <Heading>{`You got ${slotWords(p.slotLabel)}`}</Heading>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>
          The organizer of {p.eventName} assigned you {slotWords(p.slotLabel)}. Pay {p.amount} by {manila.format(new Date(p.deadlineAt))}{' '}
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
  proof_uploaded: {
    payload: z.object({ name: z.string(), shopName: z.string(), eventName: z.string(), slotLabel: z.string(), amount: z.string(), url: z.string(), supportEmail: z.string() }),
    subject: (p: { shopName: string; slotLabel: string }) => `Proof of payment from ${p.shopName} (${p.slotLabel})`,
    body: (p: { name: string; shopName: string; eventName: string; slotLabel: string; amount: string; url: string }) => (
      <>
        <Heading>Proof of payment to check</Heading>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>
          {p.shopName} uploaded proof of paying {p.amount} for {slotWords(p.slotLabel)} at {p.eventName}. Check the reference in that
          account&apos;s history before you approve it.
        </Paragraph>
        <ActionButton href={p.url}>Review the payment</ActionButton>
      </>
    ),
  },
  payment_approved: {
    payload: z.object({ name: z.string(), eventName: z.string(), slotLabel: z.string(), amount: z.string(), url: z.string(), supportEmail: z.string() }),
    subject: (p: { slotLabel: string; eventName: string }) => `You're confirmed: ${slotWords(p.slotLabel)} at ${p.eventName}`,
    body: (p: { name: string; eventName: string; slotLabel: string; url: string }) => (
      <>
        <Heading>You&apos;re confirmed</Heading>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>The organizer approved your payment. {slotWords(p.slotLabel, true)} at {p.eventName} {p.slotLabel.includes(', ') ? 'are' : 'is'} reserved for you.</Paragraph>
        <ActionButton href={p.url}>See your slot and setup details</ActionButton>
      </>
    ),
  },
  payment_rejected: {
    payload: z.object({ name: z.string(), eventName: z.string(), slotLabel: z.string(), amount: z.string(), reason: z.string(), url: z.string(), supportEmail: z.string() }),
    subject: (p: { slotLabel: string }) => `Your proof for ${slotWords(p.slotLabel)} needs another look`,
    body: (p: { name: string; eventName: string; slotLabel: string; reason: string; url: string }) => (
      <>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>The organizer of {p.eventName} couldn&apos;t approve your proof of payment for {slotWords(p.slotLabel)}.</Paragraph>
        <InfoBox label="What to fix" lines={[p.reason]} />
        <Paragraph>Fix it and upload a new screenshot. Your slot stays yours unless the organizer removes you.</Paragraph>
        <ActionButton href={p.url}>Upload new proof</ActionButton>
      </>
    ),
  },
  slot_released: {
    payload: z.object({ name: z.string(), shopName: z.string(), eventName: z.string(), slotLabel: z.string(), newPreference: z.string().optional(), url: z.string(), supportEmail: z.string() }),
    subject: (p: { shopName: string; slotLabel: string }) => `${p.shopName} released ${slotWords(p.slotLabel)}`,
    body: (p: { name: string; shopName: string; eventName: string; slotLabel: string; newPreference?: string; url: string }) => (
      <>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>
          {p.shopName} released {slotWords(p.slotLabel)} at {p.eventName} before paying.{' '}
          {p.slotLabel.includes(', ') ? 'The slots are' : 'The slot is'} open again, and they&apos;re back in your approved list without a slot.
          {p.newPreference ? ` They'd like ${slotWords(p.newPreference)} instead.` : ''}
        </Paragraph>
        <ActionButton href={p.url}>See vendors and slots</ActionButton>
      </>
    ),
  },
  vendor_removed: {
    payload: z.object({ name: z.string(), eventName: z.string(), note: z.string().nullable(), canReapply: z.boolean(), url: z.string(), supportEmail: z.string() }),
    subject: (p: { eventName: string }) => `You were removed from ${p.eventName}`,
    body: (p: { name: string; eventName: string; note: string | null; canReapply: boolean; url: string }) => (
      <>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>The organizer removed you from {p.eventName}. Your slot, if you had one, is no longer yours.</Paragraph>
        {p.note && <InfoBox label="Note from the organizer" lines={[p.note]} />}
        <Paragraph>
          {p.canReapply ? 'You can apply to this event again.' : "You can't apply to this event again."} Refunds, if any, are between you
          and the organizer. Your payment records stay on your application page.
        </Paragraph>
        <ActionButton href={p.url}>See your application</ActionButton>
      </>
    ),
  },
  event_changed: {
    payload: z.object({
      name: z.string(),
      eventName: z.string(),
      slotLabel: z.string().nullable(),
      changes: z.array(z.object({ label: z.string(), from: z.string().nullable(), to: z.string().nullable() })),
      url: z.string(),
      supportEmail: z.string(),
    }),
    subject: (p: { eventName: string; changes: { label: string }[] }) =>
      `${p.eventName}: new ${p.changes.map((c) => (c.label === 'When' ? 'date or time' : 'place')).join(' and ')}`,
    body: (p: { name: string; eventName: string; slotLabel: string | null; changes: { label: string; from: string | null; to: string | null }[]; url: string }) => (
      <>
        <Heading>{`${p.eventName} has changed`}</Heading>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>
          The organizer changed the details of an event you applied to.
          {p.slotLabel ? ` Your ${slotWords(p.slotLabel)} stays the same.` : ''}
        </Paragraph>
        {p.changes.map((c) => (
          <InfoBox key={c.label} label={c.label} lines={[`Now: ${c.to ?? 'Not set'}`, `Was: ${c.from ?? 'Not set'}`]} />
        ))}
        <ActionButton href={p.url}>See your application</ActionButton>
        <Note last>Can&apos;t make it anymore? Contact the organizer using the details on your application page.</Note>
      </>
    ),
  },
  event_canceled: {
    payload: z.object({
      name: z.string(),
      eventName: z.string(),
      schedule: z.string().nullable(),
      place: z.string().nullable(),
      slotLabel: z.string().nullable(),
      reason: z.string().nullable(),
      organizerName: z.string(),
      organizerContact: z.string().nullable(),
      url: z.string(),
      supportEmail: z.string(),
    }),
    subject: (p: { eventName: string }) => `${p.eventName} is canceled`,
    body: (p: {
      name: string;
      eventName: string;
      schedule: string | null;
      place: string | null;
      slotLabel: string | null;
      reason: string | null;
      organizerName: string;
      organizerContact: string | null;
      url: string;
    }) => (
      <>
        <Heading>{`${p.eventName} is canceled`}</Heading>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>{p.organizerName} canceled this event. It won&apos;t take place on these dates.</Paragraph>
        <InfoBox
          label={p.eventName}
          lines={[p.schedule, p.place, p.slotLabel ? `Your ${slotWords(p.slotLabel)}` : null].filter((l): l is string => l !== null)}
        />
        {p.reason && <InfoBox label="Note from the organizer" lines={[p.reason]} />}
        <Paragraph>
          Already paid? Refunds are handled by the organizer under their event policy. Creavent doesn&apos;t hold payments.
          {p.organizerContact ? ` Contact ${p.organizerName}: ${p.organizerContact}.` : ''}
        </Paragraph>
        <ActionButton href={p.url}>See your application</ActionButton>
        <Note last>Your payment records stay on your application page for 90 days, so you can download them if you need them.</Note>
      </>
    ),
  },

  // An admin hid the event (spec §2). Sent to the organizer only; vendors are
  // emailed by hand from the support inbox (flow 11).
  event_hidden: {
    payload: z.object({ name: z.string(), eventName: z.string(), reason: z.string(), url: z.string(), supportEmail: z.string() }),
    subject: (p: { eventName: string }) => `We hid ${p.eventName}`,
    body: (p: { name: string; eventName: string; reason: string; url: string; supportEmail: string }) => (
      <>
        <Heading>{`We hid ${p.eventName}`}</Heading>
        <Paragraph>Hi {firstName(p.name)},</Paragraph>
        <Paragraph>
          The Creavent team hid your event. Visitors and vendors can&apos;t find it, and you can&apos;t change it or its
          applications until we show it again.
        </Paragraph>
        <InfoBox label="Why" lines={[p.reason]} />
        <Paragraph>
          Reply to this email or write to {p.supportEmail}. If the issue is fixed, we show the event again with its
          applications and slots as they were.
        </Paragraph>
        <ActionButton href={p.url}>Open your event</ActionButton>
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
