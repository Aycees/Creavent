import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { agent, createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createUser } from './factories.js';
import { MemoryStorage } from './memory-storage.js';

type Browser = ReturnType<typeof agent>;

// Vendor and organizer onboarding (spec §1.1, flow 1) and the approval
// request (spec §2.1, flow 2).
describe('onboarding', () => {
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

  async function signedIn() {
    const user = await createUser(prisma, { fullName: 'Maria Santos' });
    return { user, browser: await signInAs(app, user.email) };
  }

  async function uploaded(browser: Browser, purpose: string, width = 400, height = 400) {
    const body = await sharp({ create: { width, height, channels: 3, background: '#fff' } }).png().toBuffer();
    const ask = await browser.post('/api/files').send({ purpose, mimeType: 'image/png', sizeBytes: body.length });
    storage.upload(`incoming/${ask.body.fileId}`, body);
    await browser.post(`/api/files/${ask.body.fileId}/complete`).send({});
    return ask.body.fileId as string;
  }

  async function roleOf(userId: string, role: 'vendor' | 'organizer') {
    return prisma.userRole.findUniqueOrThrow({ where: { userId_role: { userId, role } } });
  }

  it('needs a signed-in user', async () => {
    expect((await agent(app).get('/api/onboarding')).status).toBe(401);
  });

  it('lists the product categories in order', async () => {
    const { browser } = await signedIn();

    const res = await browser.get('/api/onboarding');

    expect(res.body.categories.map((c: { name: string }) => c.name)).toEqual([
      'Preloved clothing',
      'Vintage',
      'Handmade and crafts',
      'Food and drinks',
      'Plants',
      'Books and toys',
      'Other',
    ]);
  });

  describe('step 1, roles', () => {
    it('adds the chosen roles: organizers start at not submitted, vendors need no approval', async () => {
      const { user, browser } = await signedIn();

      const res = await browser.put('/api/onboarding/roles').send({ roles: ['vendor', 'organizer'] });

      expect(res.status).toBe(200);
      expect(await roleOf(user.id, 'vendor')).toMatchObject({ approvalStatus: null, onboardingStep: 1 });
      expect(await roleOf(user.id, 'organizer')).toMatchObject({ approvalStatus: 'not_submitted', onboardingStep: 1 });
    });

    it('adds a second role later without touching the first', async () => {
      const { user, browser } = await signedIn();
      await browser.put('/api/onboarding/roles').send({ roles: ['vendor'] });
      await prisma.userRole.updateMany({ where: { userId: user.id }, data: { onboardingStep: 4 } });

      await browser.put('/api/onboarding/roles').send({ roles: ['organizer'] });

      expect((await roleOf(user.id, 'vendor')).onboardingStep).toBe(4);
      expect((await roleOf(user.id, 'organizer')).onboardingStep).toBe(1);
    });
  });

  describe('vendor', () => {
    async function vendorWithRole() {
      const s = await signedIn();
      await s.browser.put('/api/onboarding/roles').send({ roles: ['vendor'] });
      return s;
    }

    it('saves the shop, its categories, and a page link from the shop name', async () => {
      const { user, browser } = await vendorWithRole();

      const res = await browser.put('/api/onboarding/vendor/shop').send({
        shopName: "Lola's Ukay",
        categoryIds: categoryIds.slice(0, 2),
        description: 'Hand-picked preloved tops.',
        products: 'Tops, denim',
      });

      expect(res.status).toBe(200);
      expect(res.body.vendor).toMatchObject({
        shopName: "Lola's Ukay",
        slug: 'lola-s-ukay',
        categoryIds: categoryIds.slice(0, 2),
        description: 'Hand-picked preloved tops.',
      });
      expect((await roleOf(user.id, 'vendor')).onboardingStep).toBe(2);
    });

    it('adds a number to the page link when it is taken', async () => {
      const other = await createUser(prisma);
      await prisma.vendorProfile.create({ data: { userId: other.id, shopName: 'Lolas Ukay', slug: 'lola-s-ukay' } });
      const { browser } = await vendorWithRole();

      const res = await browser
        .put('/api/onboarding/vendor/shop')
        .send({ shopName: "Lola's Ukay", categoryIds: [categoryIds[0]] });

      expect(res.body.vendor.slug).toBe('lola-s-ukay-2');
    });

    it('needs at least one category and a description of 300 characters at most', async () => {
      const { browser } = await vendorWithRole();

      const none = await browser.put('/api/onboarding/vendor/shop').send({ shopName: 'Shop', categoryIds: [] });
      const long = await browser
        .put('/api/onboarding/vendor/shop')
        .send({ shopName: 'Shop', categoryIds: [categoryIds[0]], description: 'x'.repeat(301) });

      expect(none.status).toBe(400);
      expect(long.status).toBe(400);
    });

    it('refuses the vendor steps without the vendor role', async () => {
      const { browser } = await signedIn();

      const res = await browser.put('/api/onboarding/vendor/shop').send({ shopName: 'Shop', categoryIds: [categoryIds[0]] });

      expect(res.status).toBe(403);
    });

    it('attaches the avatar and photos, in order', async () => {
      const { user, browser } = await vendorWithRole();
      await browser.put('/api/onboarding/vendor/shop').send({ shopName: 'Shop', categoryIds: [categoryIds[0]] });
      const avatar = await uploaded(browser, 'avatar');
      const photos = [await uploaded(browser, 'vendor_photo'), await uploaded(browser, 'vendor_photo')];

      const res = await browser.put('/api/onboarding/vendor/photos').send({ avatarFileId: avatar, photoFileIds: photos });

      expect(res.status).toBe(200);
      expect(res.body.avatar.id).toBe(avatar);
      expect(res.body.vendor.photos.map((p: { id: string }) => p.id)).toEqual(photos);
      expect((await roleOf(user.id, 'vendor')).onboardingStep).toBe(3);
      expect((await browser.get('/api/me')).body.avatarUrl).toBe(`https://files.test/avatar/${avatar}.webp`);
    });

    it("refuses someone else's photo, or a file meant for something else", async () => {
      const { browser } = await vendorWithRole();
      await browser.put('/api/onboarding/vendor/shop').send({ shopName: 'Shop', categoryIds: [categoryIds[0]] });
      const other = await createUser(prisma);
      const othersPhoto = await uploaded(await signInAs(app, other.email), 'vendor_photo');
      const avatarAsPhoto = await uploaded(browser, 'avatar');

      const stolen = await browser.put('/api/onboarding/vendor/photos').send({ avatarFileId: null, photoFileIds: [othersPhoto] });
      const wrongPurpose = await browser.put('/api/onboarding/vendor/photos').send({ avatarFileId: null, photoFileIds: [avatarAsPhoto] });

      expect(stolen.status).toBe(400);
      expect(wrongPurpose.status).toBe(400);
    });

    it('can skip the photos step', async () => {
      const { user, browser } = await vendorWithRole();
      await browser.put('/api/onboarding/vendor/shop').send({ shopName: 'Shop', categoryIds: [categoryIds[0]] });

      const res = await browser.put('/api/onboarding/vendor/photos').send({ avatarFileId: null, photoFileIds: [] });

      expect(res.status).toBe(200);
      expect((await roleOf(user.id, 'vendor')).onboardingStep).toBe(3);
    });

    it('saves the mobile number and social links, and finishes onboarding', async () => {
      const { user, browser } = await vendorWithRole();
      await browser.put('/api/onboarding/vendor/shop').send({ shopName: 'Shop', categoryIds: [categoryIds[0]] });
      await browser.put('/api/onboarding/vendor/photos').send({ avatarFileId: null, photoFileIds: [] });

      const res = await browser
        .put('/api/onboarding/vendor/contact')
        .send({ phone: '917 482 1093', socialLinks: ['facebook.com/lolasukay.dvo'] });

      expect(res.status).toBe(200);
      expect(res.body.phone).toBe('+639174821093');
      expect(res.body.vendor.socialLinks).toEqual(['https://facebook.com/lolasukay.dvo']);
      expect((await roleOf(user.id, 'vendor')).onboardingStep).toBe(4);
    });

    it('refuses a number that is not a Philippine mobile number', async () => {
      const { browser } = await vendorWithRole();
      await browser.put('/api/onboarding/vendor/shop').send({ shopName: 'Shop', categoryIds: [categoryIds[0]] });

      const res = await browser.put('/api/onboarding/vendor/contact').send({ phone: '12345', socialLinks: [] });

      expect(res.status).toBe(400);
    });

    it('keeps the furthest step when an earlier step is saved again', async () => {
      const { user, browser } = await vendorWithRole();
      await browser.put('/api/onboarding/vendor/shop').send({ shopName: 'Shop', categoryIds: [categoryIds[0]] });
      await browser.put('/api/onboarding/vendor/photos').send({ avatarFileId: null, photoFileIds: [] });

      await browser.put('/api/onboarding/vendor/shop').send({ shopName: 'Shop 2', categoryIds: [categoryIds[0]] });

      expect((await roleOf(user.id, 'vendor')).onboardingStep).toBe(3);
    });
  });

  describe('organizer', () => {
    async function organizerWithRole() {
      const s = await signedIn();
      await s.browser.put('/api/onboarding/roles').send({ roles: ['organizer'] });
      return s;
    }

    const page = { displayName: 'Bazaar ng Mintal', slug: 'bazaar-ng-mintal', logoFileId: null, city: 'Davao City', about: 'Monthly bazaar.' };

    it('saves the organizer page with its chosen link', async () => {
      const { user, browser } = await organizerWithRole();

      const res = await browser.put('/api/onboarding/organizer/page').send(page);

      expect(res.status).toBe(200);
      expect(res.body.organizer).toMatchObject({ displayName: 'Bazaar ng Mintal', slug: 'bazaar-ng-mintal', city: 'Davao City' });
      expect((await roleOf(user.id, 'organizer')).onboardingStep).toBe(2);
    });

    it('refuses a page link that is taken or reserved', async () => {
      const other = await createUser(prisma);
      await prisma.organizerProfile.create({ data: { userId: other.id, displayName: 'Other', slug: 'bazaar-ng-mintal' } });
      const { browser } = await organizerWithRole();

      const taken = await browser.put('/api/onboarding/organizer/page').send(page);
      const reserved = await browser.put('/api/onboarding/organizer/page').send({ ...page, slug: 'admin' });

      expect(taken.status).toBe(409);
      expect(taken.body.message).toBe('This link is taken. Try another.');
      expect(reserved.status).toBe(409);
    });

    it('saves the contact number and contact email', async () => {
      const { user, browser } = await organizerWithRole();
      await browser.put('/api/onboarding/organizer/page').send(page);

      const res = await browser
        .put('/api/onboarding/organizer/contact')
        .send({ phone: '09176502281', contactEmail: 'bazaarngmintal@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.organizer.contactEmail).toBe('bazaarngmintal@example.com');
      expect((await roleOf(user.id, 'organizer')).onboardingStep).toBe(3);
    });

    async function readyForApproval() {
      const s = await organizerWithRole();
      await s.browser.put('/api/onboarding/organizer/page').send(page);
      await s.browser.put('/api/onboarding/organizer/contact').send({ phone: '09176502281', contactEmail: 'b@example.com' });
      return s;
    }

    it('submits for review: pending, with the links saved on the organizer page', async () => {
      const { user, browser } = await readyForApproval();

      const res = await browser
        .post('/api/onboarding/organizer/approval')
        .send({ socialLinks: ['facebook.com/bazaarngmintal'], submit: true });

      expect(res.status).toBe(200);
      expect(res.body.organizer).toMatchObject({ approvalStatus: 'pending_review', socialLinks: ['https://facebook.com/bazaarngmintal'] });
      const role = await roleOf(user.id, 'organizer');
      expect(role.approvalSubmittedAt).not.toBeNull();
      expect(role.onboardingStep).toBe(4);
    });

    it('"Do this later" saves the links and leaves approval at not submitted', async () => {
      const { user, browser } = await readyForApproval();

      await browser.post('/api/onboarding/organizer/approval').send({ socialLinks: ['facebook.com/x'], submit: false });

      expect(await roleOf(user.id, 'organizer')).toMatchObject({ approvalStatus: 'not_submitted', onboardingStep: 4 });
    });

    it('needs at least one link', async () => {
      const { browser } = await readyForApproval();

      const res = await browser.post('/api/onboarding/organizer/approval').send({ socialLinks: [], submit: true });

      expect(res.status).toBe(400);
    });

    it('needs the contact details before a review can be requested', async () => {
      const { browser } = await organizerWithRole();
      await browser.put('/api/onboarding/organizer/page').send(page);

      const res = await browser.post('/api/onboarding/organizer/approval').send({ socialLinks: ['facebook.com/x'], submit: true });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Add your mobile number and contact email first');
    });

    it('lets a rejected organizer resubmit, clearing the old reason', async () => {
      const { user, browser } = await readyForApproval();
      await prisma.userRole.update({
        where: { userId_role: { userId: user.id, role: 'organizer' } },
        data: { approvalStatus: 'rejected', rejectionReason: 'Add a page with past events' },
      });

      await browser.post('/api/onboarding/organizer/approval').send({ socialLinks: ['facebook.com/x/events'], submit: true });

      expect(await roleOf(user.id, 'organizer')).toMatchObject({ approvalStatus: 'pending_review', rejectionReason: null });
    });

    it('does not let an approved organizer go back to pending', async () => {
      const { user, browser } = await readyForApproval();
      await prisma.userRole.update({ where: { userId_role: { userId: user.id, role: 'organizer' } }, data: { approvalStatus: 'approved' } });

      const res = await browser.post('/api/onboarding/organizer/approval').send({ socialLinks: ['facebook.com/x'], submit: true });

      expect(res.status).toBe(409);
      expect((await roleOf(user.id, 'organizer')).approvalStatus).toBe('approved');
    });
  });
});
