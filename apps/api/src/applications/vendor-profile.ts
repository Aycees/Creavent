import { ForbiddenException } from '@nestjs/common';
import type { PrismaService, Tx } from '../prisma/prisma.service.js';

// The vendor role, not suspended, with a shop profile.
export async function vendorProfile(db: Tx | PrismaService, userId: string) {
  const role = await db.userRole.findUnique({ where: { userId_role: { userId, role: 'vendor' } } });
  if (!role) throw new ForbiddenException('Add the vendor role first');
  if (role.suspendedAt) throw new ForbiddenException('Your vendor role is suspended');
  const profile = await db.vendorProfile.findUnique({ where: { userId }, include: { categories: true, user: true } });
  if (!profile) throw new ForbiddenException('Finish your shop profile first');
  return profile;
}
