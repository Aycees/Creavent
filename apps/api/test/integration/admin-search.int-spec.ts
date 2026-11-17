import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { agent, createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { readyEvent } from './events.js';
import { createOrganizer, createUser, createVendor } from './factories.js';

// The admin header search (sitemap §5): users by name, email, shop or
// organizer name, and events by name, drafts and hidden ones included.
describe('admin search', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('is only for admins', async () => {
    const notAdmin = await signInAs(app, (await createUser(prisma)).email);
    expect((await agent(app).get('/api/admin/search?q=a')).status).toBe(401);
    expect((await notAdmin.get('/api/admin/search?q=a')).status).toBe(403);
  });

  it('finds people by name, email, shop or organizer name, and events by name', async () => {
    const admin = await signInAs(app, (await createUser(prisma, { isAdmin: true })).email);
    const organizer = await createOrganizer(prisma, { displayName: 'Mega Sale DVO' });
    await readyEvent(prisma, organizer.profile.id, { name: 'Black Friday Mega Ukay' });
    const vendor = await createVendor(prisma);
    await prisma.vendorProfile.update({ where: { id: vendor.profile.id }, data: { shopName: 'Kalye Kicks' } });
    await prisma.user.update({ where: { id: vendor.user.id }, data: { fullName: 'Jun Reyes' } });

    const mega = await admin.get('/api/admin/search?q=mega');
    const kalye = await admin.get('/api/admin/search?q=KALYE');
    const byEmail = await admin.get(`/api/admin/search?q=${encodeURIComponent(vendor.user.email)}`);

    expect(mega.status).toBe(200);
    expect(mega.body.people.map((p: { id: string }) => p.id)).toEqual([organizer.user.id]);
    expect(mega.body.events.map((e: { name: string; subtitle: string }) => [e.name, e.subtitle])).toEqual([['Black Friday Mega Ukay', 'Mega Sale DVO · draft']]);
    expect(kalye.body.people[0]).toMatchObject({ name: 'Jun Reyes', subtitle: 'Vendor, Kalye Kicks', suspended: false });
    expect(byEmail.body.people).toHaveLength(1);
  });
});
