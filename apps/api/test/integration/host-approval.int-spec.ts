import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { assignedSlot, eventParts } from './applications.js';
import { createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { readyEvent } from './events.js';
import { createOrganizer, createUser, createVendor } from './factories.js';

// Feature 6.2: pop-up host approval (spec §4.7, flows 11 and 12).
describe('pop-up host approval', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let preloved: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    preloved = (await prisma.category.findFirstOrThrow({ where: { slug: 'preloved-clothing' } })).id;
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

  async function vendor() {
    const { user, profile } = await createVendor(prisma, [preloved]);
    return { user, profile, browser: await signInAs(app, user.email) };
  }

  async function admin() {
    const user = await createUser(prisma, { isAdmin: true });
    return signInAs(app, user.email);
  }

  const role = (userId: string) => prisma.userRole.findUniqueOrThrow({ where: { userId_role: { userId, role: 'vendor' } } });

  // A reserved slot at a market that ended and was completed.
  async function soldAtCompletedEvent(vendorProfileId: string, overrides: { status?: 'completed' | 'announced'; hidden?: boolean } = {}) {
    const { user: org, profile } = await createOrganizer(prisma);
    const eventId = await readyEvent(prisma, profile.id, {
      status: overrides.status ?? 'completed',
      startsAt: new Date('2026-10-17T09:00:00Z'),
      endsAt: new Date('2026-10-17T15:00:00Z'),
      moderationState: overrides.hidden ? 'hidden' : 'visible',
    });
    const parts = await eventParts(prisma, eventId);
    const { assignment } = await assignedSlot(prisma, { eventId, vendorProfileId, categoryId: preloved, slotId: parts.slots[0]!.id, organizerUserId: org.id });
    await prisma.slotAssignment.update({ where: { id: assignment.id }, data: { status: 'reserved' } });
    return eventId;
  }

  describe('the earned route', () => {
    it('approves a vendor who sold at a completed event, once, with no email or audit row', async () => {
      const { user, profile, browser } = await vendor();
      await prisma.vendorProfile.update({ where: { id: profile.id }, data: { socialLinks: ['https://instagram.com/lolasukay'] } });
      await soldAtCompletedEvent(profile.id);

      const first = await browser.get('/api/vendor/popups');
      const second = await browser.get('/api/vendor/popups');

      expect(first.status).toBe(200);
      expect(first.body.host).toMatchObject({ status: 'approved', source: 'earned', justEarned: true });
      expect(second.body.host).toMatchObject({ status: 'approved', justEarned: false });
      const r = await role(user.id);
      expect(r).toMatchObject({ approvalStatus: 'approved', approvalSource: 'earned', reviewedById: null });
      expect(r.reviewedLinks).toEqual(['https://instagram.com/lolasukay']);
      expect(await prisma.emailNotification.count()).toBe(0);
      expect(await prisma.auditLog.count({ where: { action: { startsWith: 'host_approval' } } })).toBe(0);
    });

    it('does nothing without a completed, visible event, or after a revoke', async () => {
      const a = await vendor();
      await soldAtCompletedEvent(a.profile.id, { status: 'announced' });
      const b = await vendor();
      await soldAtCompletedEvent(b.profile.id, { hidden: true });
      const c = await vendor();
      await soldAtCompletedEvent(c.profile.id);
      await prisma.userRole.update({ where: { id: (await role(c.user.id)).id }, data: { approvalStatus: 'rejected', hostRevokedAt: new Date() } });

      for (const v of [a, b, c]) {
        const res = await v.browser.get('/api/vendor/popups');
        expect(res.body.host.status).not.toBe('approved');
      }
    });
  });

  describe('the reviewed route', () => {
    it('needs at least one link, saves the links on the vendor page, and waits for review', async () => {
      const { user, profile, browser } = await vendor();

      const none = await browser.post('/api/vendor/host-approval').send({ socialLinks: [] });
      const res = await browser.post('/api/vendor/host-approval').send({ socialLinks: ['https://instagram.com/tahistudio'] });

      expect(none.status).toBe(400);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'pending_review', socialLinks: ['https://instagram.com/tahistudio'] });
      expect((await prisma.vendorProfile.findUniqueOrThrow({ where: { id: profile.id } })).socialLinks).toEqual(['https://instagram.com/tahistudio']);
      expect((await role(user.id)).approvalSubmittedAt).not.toBeNull();
      expect(await prisma.auditLog.count({ where: { action: 'host_approval.submit' } })).toBe(1);
    });

    it('refuses a second request while pending or approved', async () => {
      const { browser } = await vendor();
      await browser.post('/api/vendor/host-approval').send({ socialLinks: ['https://instagram.com/tahistudio'] });

      const again = await browser.post('/api/vendor/host-approval').send({ socialLinks: ['https://instagram.com/tahistudio'] });

      expect(again.status).toBe(409);
    });

    it('shows in the admin queue tagged as a host request, and an approval emails the vendor', async () => {
      const { user, browser } = await vendor();
      await browser.post('/api/vendor/host-approval').send({ socialLinks: ['https://instagram.com/tahistudio'] });
      const asAdmin = await admin();

      const queue = await asAdmin.get('/api/admin/approvals');
      const detail = await asAdmin.get(`/api/admin/approvals/hosts/${user.id}`);
      const approved = await asAdmin
        .post(`/api/admin/approvals/hosts/${user.id}/approve`)
        .send({ seen: { displayName: "Lola's Ukay", socialLinks: ['https://instagram.com/tahistudio'] } });

      expect(queue.body.items).toEqual([expect.objectContaining({ userId: user.id, kind: 'host', displayName: "Lola's Ukay" })]);
      expect(detail.status).toBe(200);
      expect(detail.body).toMatchObject({ kind: 'host', displayName: "Lola's Ukay", socialLinks: ['https://instagram.com/tahistudio'] });
      expect(approved.status).toBe(200);
      expect(await role(user.id)).toMatchObject({ approvalStatus: 'approved', approvalSource: 'reviewed' });
      expect(await prisma.emailNotification.count({ where: { type: 'host_approved', userId: user.id } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { action: 'host_approval.approve' } })).toBe(1);
    });

    it('a rejection gives the reason, and the vendor can resubmit, which clears it', async () => {
      const { user, browser } = await vendor();
      await browser.post('/api/vendor/host-approval').send({ socialLinks: ['https://instagram.com/tahistudio'] });
      const asAdmin = await admin();

      const rejected = await asAdmin
        .post(`/api/admin/approvals/hosts/${user.id}/reject`)
        .send({ seen: { displayName: "Lola's Ukay", socialLinks: ['https://instagram.com/tahistudio'] }, reason: 'Add a page with posts' });
      const state = await browser.get('/api/vendor/host-approval');
      const resubmitted = await browser.post('/api/vendor/host-approval').send({ socialLinks: ['https://instagram.com/tahistudio', 'https://facebook.com/tahi'] });

      expect(rejected.status).toBe(200);
      expect(state.body).toMatchObject({ status: 'rejected', rejectionReason: 'Add a page with posts', revoked: false });
      expect(await prisma.emailNotification.count({ where: { type: 'host_rejected' } })).toBe(1);
      expect(resubmitted.body).toMatchObject({ status: 'pending_review', rejectionReason: null });
    });

    it('is for admins only', async () => {
      const { user, browser } = await vendor();
      await browser.post('/api/vendor/host-approval').send({ socialLinks: ['https://instagram.com/tahistudio'] });

      expect((await browser.get(`/api/admin/approvals/hosts/${user.id}`)).status).toBe(403);
    });
  });

  describe('editing after approval', () => {
    async function approvedHost() {
      const v = await vendor();
      await prisma.vendorProfile.update({ where: { id: v.profile.id }, data: { socialLinks: ['https://instagram.com/lolasukay'] } });
      await prisma.userRole.update({
        where: { id: (await role(v.user.id)).id },
        data: { approvalStatus: 'approved', approvalSource: 'reviewed', reviewedLinks: ['https://instagram.com/lolasukay'] },
      });
      return v;
    }

    const body = (overrides: Record<string, unknown> = {}) => ({
      shopName: "Lola's Ukay",
      slug: 'lolas-ukay',
      categoryIds: [preloved],
      description: null,
      products: null,
      avatarFileId: null,
      photoFileIds: [],
      socialLinks: ['https://instagram.com/lolasukay'],
      ...overrides,
    });

    it('a new shop name or a new link sends an approved host back to review', async () => {
      const a = await approvedHost();
      const b = await approvedHost();

      await a.browser.put('/api/vendor/profile').send(body({ shopName: "Lola's Ukay and Vintage", slug: 'lolas-a' }));
      await b.browser.put('/api/vendor/profile').send(body({ slug: 'lolas-b', socialLinks: ['https://instagram.com/lolasukay', 'https://facebook.com/lolas'] }));

      expect((await role(a.user.id)).approvalStatus).toBe('pending_review');
      expect((await role(b.user.id)).approvalStatus).toBe('pending_review');
      expect(await prisma.auditLog.count({ where: { action: 'host_approval.re_review' } })).toBe(2);
    });

    it('removing a link or changing anything else keeps the approval', async () => {
      const a = await approvedHost();

      const res = await a.browser.put('/api/vendor/profile').send(body({ slug: 'lolas-c', description: 'Preloved tops', socialLinks: [] }));

      expect(res.status).toBe(200);
      expect((await role(a.user.id)).approvalStatus).toBe('approved');
    });
  });
});
