import { Injectable } from '@nestjs/common';
import type { AdminSearchResult } from '@creavent/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { describeRoles, statusWords } from '../reports/reports.service.js';

// The admin header search (sitemap §5). Case-insensitive contains; the MVP's
// few hundred accounts need no search index.
@Injectable()
export class AdminSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string): Promise<AdminSearchResult> {
    const contains = { contains: q, mode: 'insensitive' as const };
    const [people, events] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          roles: { some: {} },
          OR: [{ fullName: contains }, { email: contains }, { vendorProfile: { shopName: contains } }, { organizerProfile: { displayName: contains } }],
        },
        include: { roles: true, vendorProfile: true, organizerProfile: true },
        orderBy: { fullName: 'asc' },
        take: 5,
      }),
      this.prisma.event.findMany({
        where: { OR: [{ name: contains }, { organizerProfile: { displayName: contains } }] },
        include: { organizerProfile: true },
        orderBy: [{ startsAt: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
        take: 5,
      }),
    ]);
    return {
      people: people.map((u) => ({
        id: u.id,
        name: u.fullName,
        email: u.email,
        subtitle: describeRoles(u),
        suspended: u.roles.some((r) => r.suspendedAt !== null),
      })),
      events: events.map((e) => ({
        id: e.id,
        name: e.name,
        subtitle: `${e.organizerProfile.displayName} · ${statusWords[e.status] ?? e.status}${e.moderationState === 'hidden' ? ', hidden' : ''}`,
        startsAt: e.startsAt?.toISOString() ?? null,
      })),
    };
  }
}
