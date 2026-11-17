import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService, Tx } from '../prisma/prisma.service.js';

// The one way to write the audit log (docs/architecture.md §4.5): who, what,
// which record, the values before and after, and the reason. Rows are never
// updated or deleted.
export async function writeAuditLog(
  tx: Tx | PrismaService,
  entry: {
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    changes?: Prisma.InputJsonObject;
    reason?: string | null;
  },
) {
  await tx.auditLog.create({ data: entry });
}
