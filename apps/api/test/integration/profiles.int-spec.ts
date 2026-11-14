import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { agent, createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { addRole, createUser } from './factories.js';
import { MemoryStorage } from './memory-storage.js';

type Browser = ReturnType<typeof agent>;

// Profile edit pages (mockup VendorProfileEdit, OrgProfileEdit) and the
// account page's extra details (mockup Account).
describe('profile edit', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let storage: MemoryStorage;
  let categoryIds: string[];

  beforeAll(async () => {
    prisma = createTestPrisma();
    categoryIds = (await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } })).map((c) => c.id);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    storage = new MemoryStorage();
    app = await createTestApp(storage);
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function uploaded(browser: Browser, purpose: string) {
    const body = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#fff' } }).png().toBuffer();
    const ask = await browser.post('/api/files').send({ purpose, mimeType: 'image/png', sizeBytes: body.length });
    storage.upload(`incoming/${ask.body.fileId}`, body);
    await browser.post(`/api/files/${ask.body.fileId}/complete`).send({});
    return ask.body.fileId as string;
  }

  describe('vendor', () => {
    async function vendor() {
      const user = await createUser(prisma);
      await addRole(prisma, user.id, 'vendor', { onboardingStep: 4 });
      await prisma.vendorProfile.create({ data: { userId: user.id, shopName: "Lola's Ukay", slug: 'lolas-ukay' } });
      return { user, browser: await signInAs(app, user.email) };
    }

    const base = (photoFileIds: string[] = [], avatarFileId: string | null = null) => ({
      shopName: "Lola's Ukay PH",
      slug: 'lolas-ukay-ph',
      categoryIds: [categoryIds[1], categoryIds[0]],
      description: 'Preloved tops.',
      products: 'Tops',
      avatarFileId,
      photoFileIds,
      socialLinks: ['facebook.com/lolas', 'instagram.com/lolas'],
    });

    it('saves the whole shop profile, with photos in the chosen order', async () => {
      const { browser } = await vendor();
      const avatar = await uploaded(browser, 'avatar');
      const photos = [await uploaded(browser, 'vendor_photo'), await uploaded(browser, 'vendor_photo')];

      const res = await browser.put('/api/vendor/profile').send(base([photos[1], photos[0]], avatar));

      expect(res.status).toBe(200);
      expect(res.body.vendor).toMatchObject({
        shopName: "Lola's Ukay PH",
        slug: 'lolas-ukay-ph',
        description: 'Preloved tops.',
        socialLinks: ['https://facebook.com/lolas', 'https://instagram.com/lolas'],
      });
      expect(res.body.vendor.photos.map((p: { id: string }) => p.id)).toEqual([photos[1], photos[0]]);
      expect(res.body.avatar.id).toBe(avatar);
    });

    it('refuses a page link that is taken or reserved', async () => {
      const other = await createUser(prisma);
      await prisma.vendorProfile.create({ data: { userId: other.id, shopName: 'Other', slug: 'taken-shop' } });
      const { browser } = await vendor();

      const taken = await browser.put('/api/vendor/profile').send({ ...base(), slug: 'taken-shop' });
      const reserved = await browser.put('/api/vendor/profile').send({ ...base(), slug: 'admin' });

      expect(taken.status).toBe(409);
      expect(reserved.status).toBe(409);
    });

    it('says whether a page link is available, counting the user own link as available', async () => {
      const other = await createUser(prisma);
      await prisma.vendorProfile.create({ data: { userId: other.id, shopName: 'Other', slug: 'taken-shop' } });
      const { browser } = await vendor();

      const own = await browser.get('/api/profile/slug-available?kind=vendor&slug=lolas-ukay');
      const taken = await browser.get('/api/profile/slug-available?kind=vendor&slug=taken-shop');
      const free = await browser.get('/api/profile/slug-available?kind=vendor&slug=brand-new-shop');

      expect([own.body.available, taken.body.available, free.body.available]).toEqual([true, false, true]);
    });

    it('needs the vendor role', async () => {
      const user = await createUser(prisma);
      const browser = await signInAs(app, user.email);

      expect((await browser.put('/api/vendor/profile').send(base())).status).toBe(403);
    });
  });

  describe('organizer', () => {
    async function organizer(approvalStatus: 'not_submitted' | 'pending_review' | 'approved' | 'rejected') {
      const user = await createUser(prisma, { phone: '+639171234567' });
      await addRole(prisma, user.id, 'organizer', { approvalStatus, onboardingStep: 4 });
      await prisma.userRole.update({
        where: { userId_role: { userId: user.id, role: 'organizer' } },
        data: {
          contactEmail: 'old@example.com',
          approvalSubmittedAt: new Date('2026-11-01T00:00:00Z'),
          reviewedAt: approvalStatus === 'approved' ? new Date('2026-11-02T00:00:00Z') : null,
          reviewedLinks: approvalStatus === 'approved' ? ['https://facebook.com/mintal'] : undefined,
        },
      });
      await prisma.organizerProfile.create({
        data: { userId: user.id, displayName: 'Bazaar ng Mintal', slug: 'mintal', socialLinks: ['https://facebook.com/mintal'] },
      });
      return { user, browser: await signInAs(app, user.email) };
    }

    const base = {
      displayName: 'Bazaar ng Mintal',
      slug: 'mintal',
      logoFileId: null,
      city: 'Davao City',
      about: 'Monthly.',
      socialLinks: ['https://facebook.com/mintal'],
      contactEmail: 'old@example.com',
    };

    async function statusOf(userId: string) {
      return (await prisma.userRole.findUniqueOrThrow({ where: { userId_role: { userId, role: 'organizer' } } })).approvalStatus;
    }

    it('saves the page details, link, and contact email without a new review', async () => {
      const { user, browser } = await organizer('approved');

      const res = await browser
        .put('/api/organizer/profile')
        .send({ ...base, slug: 'bazaar-mintal', about: 'Twice a month.', contactEmail: 'new@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.organizer).toMatchObject({ slug: 'bazaar-mintal', about: 'Twice a month.', contactEmail: 'new@example.com', approvalStatus: 'approved' });
      expect(await statusOf(user.id)).toBe('approved');
    });

    it('sends an approved organizer back to review when the name changes, and records it', async () => {
      const { user, browser } = await organizer('approved');

      const res = await browser.put('/api/organizer/profile').send({ ...base, displayName: 'Someone Famous' });

      expect(res.body.organizer.approvalStatus).toBe('pending_review');
      expect(await statusOf(user.id)).toBe('pending_review');
      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'organizer_approval.re_review' } });
      expect(log).toMatchObject({ actorUserId: user.id, changes: { approvalStatus: { from: 'approved', to: 'pending_review' } } });
    });

    it('sends an approved organizer back to review when a new link is added, but not when one is removed', async () => {
      const added = await organizer('approved');
      await added.browser.put('/api/organizer/profile').send({ ...base, socialLinks: ['https://facebook.com/mintal', 'https://elsewhere.example'] });
      expect(await statusOf(added.user.id)).toBe('pending_review');

      await resetDatabase(prisma);
      const removed = await organizer('approved');
      await prisma.userRole.update({
        where: { userId_role: { userId: removed.user.id, role: 'organizer' } },
        data: { reviewedLinks: ['https://facebook.com/mintal', 'https://instagram.com/mintal'] },
      });
      await prisma.organizerProfile.update({
        where: { userId: removed.user.id },
        data: { socialLinks: ['https://facebook.com/mintal', 'https://instagram.com/mintal'] },
      });
      await removed.browser.put('/api/organizer/profile').send(base);
      expect(await statusOf(removed.user.id)).toBe('approved');
    });

    it('keeps the status of an organizer who is not approved', async () => {
      const { user, browser } = await organizer('rejected');

      await browser.put('/api/organizer/profile').send({ ...base, displayName: 'New name' });

      expect(await statusOf(user.id)).toBe('rejected');
    });

    it('needs at least one link', async () => {
      const { browser } = await organizer('approved');

      expect((await browser.put('/api/organizer/profile').send({ ...base, socialLinks: [] })).status).toBe(400);
    });

    it('records the reviewed links when an admin approves', async () => {
      const { user } = await organizer('pending_review');
      const admin = await createUser(prisma, { isAdmin: true });
      const adminBrowser = await signInAs(app, admin.email);

      await adminBrowser
        .post(`/api/admin/approvals/${user.id}/approve`)
        .send({ seen: { displayName: 'Bazaar ng Mintal', socialLinks: ['https://facebook.com/mintal'] } });
      const state = await (await signInAs(app, user.email)).get('/api/profile');

      expect(state.body.organizer.reviewedLinks).toEqual(['https://facebook.com/mintal']);
      expect(state.body.organizer.reviewedAt).not.toBeNull();
    });
  });

  describe('account', () => {
    it('saves the name and mobile number together', async () => {
      const user = await createUser(prisma);
      const browser = await signInAs(app, user.email);

      const res = await browser.patch('/api/me').send({ fullName: 'Maria Clara', phone: '0918 111 2222' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ fullName: 'Maria Clara', phone: '+639181112222' });
    });

    it('refuses a phone number that is not a Philippine mobile number', async () => {
      const user = await createUser(prisma);
      const browser = await signInAs(app, user.email);

      expect((await browser.patch('/api/me').send({ fullName: 'Maria', phone: '12345' })).status).toBe(400);
    });

    it('sets and removes the profile picture', async () => {
      const user = await createUser(prisma);
      const browser = await signInAs(app, user.email);
      const avatar = await uploaded(browser, 'avatar');

      const set = await browser.put('/api/me/avatar').send({ avatarFileId: avatar });
      const removed = await browser.put('/api/me/avatar').send({ avatarFileId: null });

      expect(set.body.avatarUrl).toBe(`https://files.test/avatar/${avatar}.webp`);
      expect(removed.body.avatarUrl).toBeNull();
    });

    it('lists the accepted agreements, sign-in methods, and roles', async () => {
      const user = await createUser(prisma);
      await addRole(prisma, user.id, 'vendor');
      await prisma.vendorProfile.create({ data: { userId: user.id, shopName: "Lola's Ukay", slug: 'lolas' } });
      const browser = await signInAs(app, user.email);

      const res = await browser.get('/api/account');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ googleLinked: false, vendor: { shopName: "Lola's Ukay" }, organizer: null });
      expect(res.body.passwordChangedAt).not.toBeNull();
      expect(res.body.legal.map((l: { document: string }) => l.document).sort()).toEqual(['privacy', 'terms']);
    });
  });
});
