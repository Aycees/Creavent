import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { agent, createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { addRole, createUser } from './factories.js';

// Organizer approval, admin side (spec §2.1, flow 11).
describe('admin approvals', () => {
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

  async function admin() {
    const user = await createUser(prisma, { isAdmin: true, fullName: 'Ana Admin' });
    return { user, browser: await signInAs(app, user.email) };
  }

  async function pendingOrganizer(name: string, submittedAt: Date) {
    const user = await createUser(prisma, { fullName: `${name} Owner`, phone: '+639171234567' });
    await addRole(prisma, user.id, 'organizer', { approvalStatus: 'pending_review', onboardingStep: 4 });
    await prisma.userRole.update({
      where: { userId_role: { userId: user.id, role: 'organizer' } },
      data: { approvalSubmittedAt: submittedAt, contactEmail: `${name.toLowerCase()}@example.com` },
    });
    await prisma.organizerProfile.create({
      data: { userId: user.id, displayName: name, slug: name.toLowerCase(), city: 'Davao City', socialLinks: ['https://facebook.com/a', 'https://facebook.com/b'] },
    });
    return user;
  }

  const seen = (name: string) => ({ displayName: name, socialLinks: ['https://facebook.com/a', 'https://facebook.com/b'] });

  async function roleOf(userId: string) {
    return prisma.userRole.findUniqueOrThrow({ where: { userId_role: { userId, role: 'organizer' } } });
  }

  it('is only for admins', async () => {
    const organizer = await pendingOrganizer('Mintal', new Date());
    const notAdmin = await signInAs(app, (await createUser(prisma)).email);

    expect((await agent(app).get('/api/admin/approvals')).status).toBe(401);
    expect((await notAdmin.get('/api/admin/approvals')).status).toBe(403);
    expect((await notAdmin.post(`/api/admin/approvals/${organizer.id}/approve`).send({ seen: seen('Mintal') })).status).toBe(403);
    expect((await roleOf(organizer.id)).approvalStatus).toBe('pending_review');
  });

  it('lists organizers waiting for review, oldest first', async () => {
    const { browser } = await admin();
    await pendingOrganizer('Newer', new Date('2026-11-12T10:00:00Z'));
    await pendingOrganizer('Older', new Date('2026-11-10T10:00:00Z'));
    const notSubmitted = await createUser(prisma);
    await addRole(prisma, notSubmitted.id, 'organizer');

    const res = await browser.get('/api/admin/approvals');

    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { displayName: string }) => i.displayName)).toEqual(['Older', 'Newer']);
    expect(res.body.items[0]).toMatchObject({ linksCount: 2, city: 'Davao City', resubmission: false });
  });

  it('shows a request with its links, contact details, account, and place in the queue', async () => {
    const { browser } = await admin();
    const first = await pendingOrganizer('First', new Date('2026-11-10T10:00:00Z'));
    const second = await pendingOrganizer('Second', new Date('2026-11-11T10:00:00Z'));

    const res = await browser.get(`/api/admin/approvals/${first.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      displayName: 'First',
      socialLinks: ['https://facebook.com/a', 'https://facebook.com/b'],
      contactEmail: 'first@example.com',
      phone: '+639171234567',
      roles: ['organizer'],
      status: 'pending_review',
      queue: { position: 1, total: 2, nextUserId: second.id },
    });
  });

  it('approves: the badge status, the review, an email, and an audit log row', async () => {
    const { user: adminUser, browser } = await admin();
    const organizer = await pendingOrganizer('Mintal', new Date());

    const res = await browser.post(`/api/admin/approvals/${organizer.id}/approve`).send({ note: 'Checked 3 past events', seen: seen('Mintal') });

    expect(res.status).toBe(200);
    expect(await roleOf(organizer.id)).toMatchObject({
      approvalStatus: 'approved',
      reviewedById: adminUser.id,
      adminNotes: 'Checked 3 past events',
    });
    // To the contact email the organizer gave for their approval.
    const email = await prisma.emailNotification.findFirstOrThrow({ where: { type: 'organizer_approved' } });
    expect(email.toEmail).toBe('mintal@example.com');
    const log = await prisma.auditLog.findFirstOrThrow();
    expect(log).toMatchObject({
      actorUserId: adminUser.id,
      action: 'organizer_approval.approve',
      entityType: 'user_role',
      changes: { approvalStatus: { from: 'pending_review', to: 'approved' } },
    });
  });

  it('rejects with a reason the organizer sees, and emails it', async () => {
    const { browser } = await admin();
    const organizer = await pendingOrganizer('Mintal', new Date());

    const res = await browser
      .post(`/api/admin/approvals/${organizer.id}/reject`)
      .send({ reason: 'Add a page that shows your past events', note: 'Page is 2 days old', seen: seen('Mintal') });

    expect(res.status).toBe(200);
    expect(await roleOf(organizer.id)).toMatchObject({
      approvalStatus: 'rejected',
      rejectionReason: 'Add a page that shows your past events',
      adminNotes: 'Page is 2 days old',
    });
    const email = await prisma.emailNotification.findFirstOrThrow({ where: { type: 'organizer_rejected' } });
    expect(email.payload).toMatchObject({ reason: 'Add a page that shows your past events' });
    expect((await prisma.auditLog.findFirstOrThrow()).reason).toBe('Add a page that shows your past events');
  });

  it('needs a reason to reject', async () => {
    const { browser } = await admin();
    const organizer = await pendingOrganizer('Mintal', new Date());

    const res = await browser.post(`/api/admin/approvals/${organizer.id}/reject`).send({ reason: ' ', seen: seen('Mintal') });

    expect(res.status).toBe(400);
    expect((await roleOf(organizer.id)).approvalStatus).toBe('pending_review');
  });

  it('only decides requests that are waiting for review', async () => {
    const { browser } = await admin();
    const organizer = await pendingOrganizer('Mintal', new Date());
    await browser.post(`/api/admin/approvals/${organizer.id}/approve`).send({ seen: seen('Mintal') });

    const again = await browser.post(`/api/admin/approvals/${organizer.id}/reject`).send({ reason: 'No', seen: seen('Mintal') });

    expect(again.status).toBe(409);
    expect((await roleOf(organizer.id)).approvalStatus).toBe('approved');
    expect(await prisma.emailNotification.count()).toBe(1);
  });

  it('refuses a decision when the organizer changed their name or links since the admin opened it', async () => {
    const { browser } = await admin();
    const organizer = await pendingOrganizer('Mintal', new Date());
    await prisma.organizerProfile.update({
      where: { userId: organizer.id },
      data: { displayName: 'Someone Famous', socialLinks: ['https://facebook.com/famous'] },
    });

    const res = await browser.post(`/api/admin/approvals/${organizer.id}/approve`).send({ seen: seen('Mintal') });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('This request changed since you opened it. Reload to see the new details.');
    expect((await roleOf(organizer.id)).approvalStatus).toBe('pending_review');
  });

  it('never ends approved with a name the admin did not see, when the organizer edits at the same moment', async () => {
    const { browser } = await admin();
    for (let i = 0; i < 5; i += 1) {
      const organizer = await pendingOrganizer(`Market${i}`, new Date());
      const organizerBrowser = await signInAs(app, organizer.email);

      await Promise.all([
        browser.post(`/api/admin/approvals/${organizer.id}/approve`).send({ seen: seen(`Market${i}`) }),
        organizerBrowser.put('/api/organizer/profile').send({
          displayName: 'Someone Famous',
          slug: `market${i}`,
          logoFileId: null,
          city: 'Davao City',
          about: null,
          socialLinks: ['https://facebook.com/a', 'https://facebook.com/b'],
          contactEmail: 'x@example.com',
        }),
      ]);

      const role = await roleOf(organizer.id);
      const profile = await prisma.organizerProfile.findUniqueOrThrow({ where: { userId: organizer.id } });
      expect(profile.displayName).toBe('Someone Famous');
      expect(role.approvalStatus).toBe('pending_review');
    }
  });

  it('marks a request reviewed before as a resubmission', async () => {
    const { browser } = await admin();
    const organizer = await pendingOrganizer('Mintal', new Date());
    await prisma.userRole.update({
      where: { userId_role: { userId: organizer.id, role: 'organizer' } },
      data: { reviewedAt: new Date('2026-11-01T00:00:00Z') },
    });

    const res = await browser.get('/api/admin/approvals');

    expect(res.body.items[0].resubmission).toBe(true);
  });
});
