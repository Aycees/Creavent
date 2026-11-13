import type { AppConfig } from '../config.js';
import type { Tx } from '../prisma/prisma.service.js';

// Records the current terms and privacy versions as accepted (spec §1).
// Acceptance rows are never updated or deleted.
export async function recordLegalAcceptance(tx: Tx, userId: string, config: AppConfig) {
  await tx.legalAcceptance.createMany({
    data: [
      { userId, document: 'terms', version: config.termsVersion },
      { userId, document: 'privacy', version: config.privacyVersion },
    ],
  });
}

// True when the user must accept the current versions or confirm their age
// before any other page.
export async function needsLegal(tx: Tx, userId: string, config: AppConfig) {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { ageConfirmedAt: true },
  });
  if (!user.ageConfirmedAt) return true;
  const [terms, privacy] = await Promise.all([
    tx.legalAcceptance.findFirst({
      where: { userId, document: 'terms', version: config.termsVersion },
    }),
    tx.legalAcceptance.findFirst({
      where: { userId, document: 'privacy', version: config.privacyVersion },
    }),
  ]);
  return !terms || !privacy;
}
