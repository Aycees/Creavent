// Platform values (data model §5.11). Environment variables with defaults, so
// changing one needs a deploy, not a code change.
export function appConfig() {
  return {
    // The web app's origin. Links in emails point here, and /api/* on it
    // reaches this API (docs/architecture.md §4.3).
    webUrl: process.env.WEB_URL ?? 'http://localhost:3100',
    // Shared with the web app, which refreshes cached public pages when the
    // API asks with it (decision Q1). Unset: no refresh is asked for.
    revalidateSecret: process.env.REVALIDATE_SECRET ?? '',
    termsVersion: process.env.TERMS_VERSION ?? '2026-11-12',
    privacyVersion: process.env.PRIVACY_VERSION ?? '2026-11-12',
    // Placeholder until the support address exists (development plan §9).
    supportEmail: process.env.SUPPORT_EMAIL ?? 'support@creavent.example',
    minimumAge: Number(process.env.MINIMUM_AGE ?? 18),
    // Days after an event (or its cancellation) that payment records and
    // application documents are kept (spec §6.7). Placeholder until the legal review.
    proofRetentionDays: Number(process.env.PROOF_RETENTION_DAYS ?? 90),
    // Hours a vendor has to pay after a slot is assigned, for new events (data model §5.11).
    defaultPaymentDeadlineHours: Number(process.env.DEFAULT_PAYMENT_DEADLINE_HOURS ?? 24),
    // Shown on the Policy tab of an organizer's first event (spec §3.7).
    examplePolicyText:
      process.env.EXAMPLE_POLICY_TEXT ??
      [
        'Pay your slot fee within 24 hours of being assigned a slot. Unpaid slots may be given to another vendor.',
        'If you withdraw 7 or more days before the event, we refund 50% of your fee. Within 7 days, fees are not refundable.',
        'If we cancel the event, you get a full refund within 5 days.',
      ].join('\n\n'),
  };
}

export type AppConfig = ReturnType<typeof appConfig>;
