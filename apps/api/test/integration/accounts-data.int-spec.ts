import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { addRole, createUser } from './factories.js';

// Rules the database guarantees for accounts (data model §1, §6.1).
describe('accounts data rules', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('refuses a second account with the same email in different letter case', async () => {
    await createUser(prisma, { email: 'Maria.Santos@gmail.com' });

    await expect(
      createUser(prisma, { email: 'maria.santos@GMAIL.com' }),
    ).rejects.toThrow(/Unique constraint/);
  });

  it('finds a user by email without regard to case', async () => {
    const user = await createUser(prisma, { email: 'Lola@Example.com' });

    const found = await prisma.user.findUnique({
      where: { email: 'lola@example.com' },
    });

    expect(found?.id).toBe(user.id);
  });

  it('refuses the same role twice for one user', async () => {
    const user = await createUser(prisma);
    await addRole(prisma, user.id, 'vendor');

    await expect(addRole(prisma, user.id, 'vendor')).rejects.toThrow(
      /Unique constraint/,
    );
  });

  it('lets one user hold both roles', async () => {
    const user = await createUser(prisma);
    await addRole(prisma, user.id, 'vendor');
    await addRole(prisma, user.id, 'organizer');

    expect(await prisma.userRole.count({ where: { userId: user.id } })).toBe(2);
  });
});
