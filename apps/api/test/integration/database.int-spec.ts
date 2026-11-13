import type { PrismaClient } from '../../generated/prisma/client.js';
import { createTestPrisma, resetDatabase } from './db.js';

describe('integration database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('runs on PostgreSQL 17', async () => {
    const [row] = await prisma.$queryRaw<
      { server_version: string }[]
    >`SHOW server_version`;

    expect(row.server_version).toMatch(/^17\./);
  });

  it('resets data between tests', async () => {
    await prisma.$executeRaw`CREATE TABLE reset_check (id int PRIMARY KEY)`;
    try {
      await prisma.$executeRaw`INSERT INTO reset_check VALUES (1), (2)`;

      await resetDatabase(prisma);

      const [row] = await prisma.$queryRaw<
        { count: bigint }[]
      >`SELECT count(*) FROM reset_check`;
      expect(row.count).toBe(0n);
    } finally {
      await prisma.$executeRaw`DROP TABLE reset_check`;
    }
  });
});
