// Platform values (data model §5.11). Environment variables with defaults, so
// changing one needs a deploy, not a code change.
export function appConfig() {
  return {
    // The web app's origin. Links in emails point here, and /api/* on it
    // reaches this API (docs/architecture.md §4.3).
    webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
    termsVersion: process.env.TERMS_VERSION ?? '2026-11-12',
    privacyVersion: process.env.PRIVACY_VERSION ?? '2026-11-12',
    // Placeholder until the support address exists (development plan §9).
    supportEmail: process.env.SUPPORT_EMAIL ?? 'support@creavent.example',
    minimumAge: Number(process.env.MINIMUM_AGE ?? 18),
  };
}

export type AppConfig = ReturnType<typeof appConfig>;
