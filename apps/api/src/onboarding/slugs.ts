import { slugify } from '@creavent/shared';
import type { Tx } from '../prisma/prisma.service.js';

// Words that can't be page links, because they are or may become pages (spec §7.2).
export const RESERVED_SLUGS = new Set([
  'new', 'edit', 'admin', 'api', 'login', 'logout', 'signup', 'account', 'settings', 'onboarding',
  'vendor', 'vendors', 'organizer', 'organizers', 'event', 'events', 'approved', 'support',
  'terms', 'privacy', 'help', 'creavent',
]);

type Kind = 'vendor' | 'organizer' | 'event';

async function isTaken(tx: Tx, kind: Kind, slug: string, userId: string) {
  const where = { slug, NOT: { userId } };
  const found =
    kind === 'vendor'
      ? await tx.vendorProfile.findFirst({ where, select: { id: true } })
      : kind === 'organizer'
        ? await tx.organizerProfile.findFirst({ where, select: { id: true } })
        : await tx.event.findFirst({ where: { slug }, select: { id: true } });
  return found !== null;
}

export async function slugAvailable(tx: Tx, kind: Kind, slug: string, userId: string) {
  return !RESERVED_SLUGS.has(slug) && !(await isTaken(tx, kind, slug, userId));
}

// A free page link from a name. When the generated one is taken, a number is
// added (spec §7.2).
export async function freeSlug(tx: Tx, kind: Kind, name: string, userId: string) {
  const base = slugify(name);
  for (let n = 1; ; n += 1) {
    const suffix = n === 1 ? '' : `-${n}`;
    const candidate = `${base.slice(0, 40 - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (await slugAvailable(tx, kind, candidate, userId)) return candidate;
  }
}
