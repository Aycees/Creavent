import { ForbiddenException } from '@nestjs/common';
import type { PrismaService, Tx } from '../prisma/prisma.service.js';

// The vendor role, not suspended, with a shop profile. Pages that only show
// something pass `read`: a suspended vendor still sees their applications and
// payment details, but can't change anything (spec §2.1, decided 2026-11-17).
export async function vendorProfile(db: Tx | PrismaService, userId: string, options: { read?: boolean } = {}) {
  const role = await db.userRole.findUnique({ where: { userId_role: { userId, role: 'vendor' } } });
  if (!role) throw new ForbiddenException('Add the vendor role first');
  if (role.suspendedAt && !options.read) throw new ForbiddenException('Your vendor role is suspended');
  const profile = await db.vendorProfile.findUnique({ where: { userId }, include: { categories: true, user: true } });
  if (!profile) throw new ForbiddenException('Finish your shop profile first');
  return profile;
}
