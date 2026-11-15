import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { signInAs } from './app.js';
import { createTestApp } from './app.js';
import { eventParts, readyFile, submittedApplication } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// Feature 3.1: apply and withdraw (spec §4.2, §4.3, flow 4).
describe('applying to an event', () => {
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

  // An open event and a vendor who sells preloved clothing and food.
  async function setup(overrides: Parameters<typeof readyEvent>[2] = {}) {
    const organizer = await createOrganizer(prisma);
    await prisma.userRole.update({
      where: { userId_role: { userId: organizer.user.id, role: 'organizer' } },
      data: { contactEmail: 'rhea@balikgamit.ph' },
    });
    const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', ...overrides });
    const parts = await eventParts(prisma, eventId);
    const vendor = await createVendor(prisma, [parts.preloved.id, parts.food.id]);
    const browser = await signInAs(app, vendor.user.email);
    return { organizer, eventId, ...parts, vendor, browser };
  }

  type Setup = Awaited<ReturnType<typeof setup>>;

  async function apply(s: Setup, body: Record<string, unknown> = {}) {
    const clearance = await readyFile(prisma, s.vendor.user.id);
    return s.browser.post(`/api/vendor/events/${s.event.slug}/applications`).send({
      categoryIds: [s.preloved.id],
      documents: [{ requirementId: s.clearance.id, fileIds: [clearance.id] }],
      ...body,
    });
  }

  describe('the apply form', () => {
    it("lists the vendor's accepted categories with spots left, and the documents", async () => {
      const s = await setup();
      const other = await createVendor(prisma, [s.preloved.id]);
      await prisma.application.update({
        where: { id: (await submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: other.profile.id, categoryId: s.preloved.id })).id },
        data: { status: 'approved' },
      });

      const res = await s.browser.get(`/api/vendor/events/${s.event.slug}/apply`);

      expect(res.status).toBe(200);
      expect(res.body.blocked).toBeNull();
      expect(res.body.categories).toEqual([
        { id: s.preloved.id, name: s.preloved.name, max: 12, left: 11 },
        { id: s.food.id, name: s.food.name, max: null, left: null },
      ]);
      expect(res.body.documents.map((d: { name: string; categoryName: string | null }) => [d.name, d.categoryName])).toEqual([
        ['Barangay business clearance', null],
        ['Sanitary permit', s.food.name],
      ]);
      expect(res.body.event).toMatchObject({ name: s.event.name, policy: 'Pay within 24 hours.', deadlineHours: 24, preferredSlots: false });
      expect(res.body.slotGroups).toEqual([]);
    });

    it('shows the slots, open or taken, when vendors may choose a preferred slot', async () => {
      const s = await setup({ slotMode: 'vendor_preference' });

      const res = await s.browser.get(`/api/vendor/events/${s.event.slug}/apply`);

      expect(res.body.slotGroups).toEqual([
        {
          name: 'Main walkway',
          slots: [
            { id: s.slots[0].id, label: 'A-01', sizeLabel: '2 × 2 m', note: null, price: 800, taken: false },
            { id: s.slots[1].id, label: 'A-02', sizeLabel: '2 × 2 m', note: null, price: 800, taken: false },
          ],
        },
        { name: 'Entrance', slots: [{ id: s.slots[2].id, label: 'B-01', sizeLabel: '3 × 3 m', note: 'Near the gate', price: 1500, taken: false }] },
      ]);
    });

    it('says why the vendor cannot apply', async () => {
      const s = await setup({ applicationsOpen: false });

      expect((await s.browser.get(`/api/vendor/events/${s.event.slug}/apply`)).body.blocked).toBe('closed');

      await prisma.event.update({ where: { id: s.eventId }, data: { applicationsOpen: true } });
      const first = await apply(s);
      const again = await s.browser.get(`/api/vendor/events/${s.event.slug}/apply`);
      expect(again.body).toMatchObject({ blocked: 'already_applied', activeApplicationId: first.body.id });
    });

    it('is Not found for a draft or hidden event', async () => {
      const s = await setup();
      await prisma.event.update({ where: { id: s.eventId }, data: { moderationState: 'hidden' } });

      expect((await s.browser.get(`/api/vendor/events/${s.event.slug}/apply`)).status).toBe(404);
    });
  });

  describe('submitting', () => {
    it('creates a submitted application with the policy snapshot, and emails the organizer', async () => {
      const s = await setup();

      const res = await apply(s, { note: 'Near other clothing stalls, please.' });

      expect(res.status).toBe(201);
      const application = await prisma.application.findUniqueOrThrow({
        where: { id: res.body.id },
        include: { categories: true, documents: true },
      });
      expect(application).toMatchObject({
        status: 'submitted',
        eventId: s.eventId,
        vendorProfileId: s.vendor.profile.id,
        policyTextSnapshot: 'Pay within 24 hours.',
        vendorNote: 'Near other clothing stalls, please.',
        preferredSlotId: null,
      });
      expect(application.categories.map((c) => c.categoryId)).toEqual([s.preloved.id]);
      expect(application.documents).toHaveLength(1);
      const email = await prisma.emailNotification.findFirstOrThrow({ where: { type: 'application_submitted' } });
      expect(email).toMatchObject({ toEmail: 'rhea@balikgamit.ph', userId: s.organizer.user.id, relatedEntityId: application.id });
      expect(email.payload).toMatchObject({ shopName: "Lola's Ukay", eventName: s.event.name });
    });

    it('refuses a category the vendor does not sell or the event does not accept', async () => {
      const s = await setup();
      const vintage = await prisma.category.findFirstOrThrow({ where: { slug: 'vintage' } });
      await prisma.vendorProfileCategory.create({ data: { vendorProfileId: s.vendor.profile.id, categoryId: vintage.id } });

      const res = await apply(s, { categoryIds: [vintage.id] });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Pick categories you sell that this event accepts");
    });

    it('needs every required document for the picked categories', async () => {
      const s = await setup();

      const missing = await apply(s, { documents: [] });
      expect(missing.status).toBe(400);
      expect(missing.body.message).toBe('Upload your Barangay business clearance');

      const food = await apply(s, { categoryIds: [s.food.id] });
      expect(food.status).toBe(400);
      expect(food.body.message).toBe('Upload your Sanitary permit');
    });

    it("refuses a file that isn't the vendor's ready document", async () => {
      const s = await setup();
      const other = await createVendor(prisma);
      const theirs = await readyFile(prisma, other.user.id);
      const photo = await readyFile(prisma, s.vendor.user.id, 'vendor_photo');

      for (const fileId of [theirs.id, photo.id]) {
        const res = await apply(s, { documents: [{ requirementId: s.clearance.id, fileIds: [fileId] }] });
        expect(res.status).toBe(400);
      }
    });

    it('refuses a requirement of another event', async () => {
      const s = await setup();
      const otherEvent = await eventParts(prisma, await readyEvent(prisma, s.organizer.profile.id, { status: 'open_to_vendors' }));
      const file = await readyFile(prisma, s.vendor.user.id);

      const res = await apply(s, {
        documents: [
          { requirementId: s.clearance.id, fileIds: [file.id] },
          { requirementId: otherEvent.clearance.id, fileIds: [(await readyFile(prisma, s.vendor.user.id)).id] },
        ],
      });

      expect(res.status).toBe(400);
    });

    it('refuses while applications are closed, by the organizer or the close date', async () => {
      const closed = await setup({ applicationsOpen: false });
      expect((await apply(closed)).status).toBe(409);

      await resetDatabase(prisma);
      const past = await setup({ applicationsCloseAt: new Date(Date.now() - 60_000) });
      const res = await apply(past);
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Applications are closed for this event');
    });

    it('allows one active application per event', async () => {
      const s = await setup();
      await apply(s);

      const res = await apply(s);

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('You already applied to this event');
    });

    it('lets the database refuse a second active application', async () => {
      const s = await setup();
      await submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: s.vendor.profile.id, categoryId: s.preloved.id });

      await expect(
        submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: s.vendor.profile.id, categoryId: s.preloved.id }),
      ).rejects.toThrow();
    });

    it('keeps a preferred slot only when the event lets vendors choose', async () => {
      const assigns = await setup();
      const ignored = await apply(assigns, { preferredSlotId: assigns.slots[0].id });
      expect((await prisma.application.findUniqueOrThrow({ where: { id: ignored.body.id } })).preferredSlotId).toBeNull();

      await resetDatabase(prisma);
      const choose = await setup({ slotMode: 'vendor_preference' });
      const kept = await apply(choose, { preferredSlotId: choose.slots[2].id });
      expect(kept.status).toBe(201);
      expect((await prisma.application.findUniqueOrThrow({ where: { id: kept.body.id } })).preferredSlotId).toBe(choose.slots[2].id);
    });

    it('refuses a preferred slot of another event or one that was removed', async () => {
      const s = await setup({ slotMode: 'vendor_preference' });
      const other = await eventParts(prisma, await readyEvent(prisma, s.organizer.profile.id, { status: 'open_to_vendors' }));
      await prisma.slot.update({ where: { id: s.slots[1].id }, data: { deletedAt: new Date() } });

      for (const slotId of [other.slots[0].id, s.slots[1].id]) {
        const res = await apply(s, { preferredSlotId: slotId });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Pick an open slot, or No preference');
      }
    });

    it('refuses a suspended vendor and a vendor without a mobile number', async () => {
      const s = await setup();
      await prisma.userRole.update({ where: { userId_role: { userId: s.vendor.user.id, role: 'vendor' } }, data: { suspendedAt: new Date() } });
      expect((await apply(s)).status).toBe(403);

      await prisma.userRole.update({ where: { userId_role: { userId: s.vendor.user.id, role: 'vendor' } }, data: { suspendedAt: null } });
      await prisma.user.update({ where: { id: s.vendor.user.id }, data: { phone: null } });
      const res = await apply(s);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Add your shop name, mobile number, and a category first');
    });
  });

  describe('withdrawing', () => {
    it('withdraws a submitted application, emails the organizer, and allows applying again', async () => {
      const s = await setup();
      const first = await apply(s);

      const res = await s.browser.post(`/api/vendor/applications/${first.body.id}/withdraw`).send({});

      expect(res.status).toBe(201);
      const application = await prisma.application.findUniqueOrThrow({ where: { id: first.body.id } });
      expect(application.status).toBe('withdrawn');
      expect(application.withdrawnAt).not.toBeNull();
      expect(await prisma.emailNotification.count({ where: { type: 'application_withdrawn', toEmail: 'rhea@balikgamit.ph' } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { entityId: first.body.id, action: 'application.withdraw' } })).toBe(1);
      expect((await apply(s)).status).toBe(201);
    });

    it('refuses to withdraw once the application is decided', async () => {
      const s = await setup();
      const first = await apply(s);
      await prisma.application.update({ where: { id: first.body.id }, data: { status: 'approved' } });

      const res = await s.browser.post(`/api/vendor/applications/${first.body.id}/withdraw`).send({});

      expect(res.status).toBe(409);
    });

    it("is Not found for another vendor's application", async () => {
      const s = await setup();
      const first = await apply(s);
      const other = await createVendor(prisma, [s.preloved.id]);
      const browser = await signInAs(app, other.user.email);

      expect((await browser.post(`/api/vendor/applications/${first.body.id}/withdraw`).send({})).status).toBe(404);
    });
  });

  describe('after removal', () => {
    it('lets a removed vendor reapply only when the organizer allowed it', async () => {
      const s = await setup();
      const old = await submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: s.vendor.profile.id, categoryId: s.preloved.id });
      await prisma.application.update({ where: { id: old.id }, data: { status: 'removed', canReapply: false } });

      const refused = await apply(s);
      expect(refused.status).toBe(409);
      expect(refused.body.message).toBe("You can't reapply to this event");
      expect((await s.browser.get(`/api/vendor/events/${s.event.slug}/apply`)).body.blocked).toBe('cannot_reapply');

      await prisma.application.update({ where: { id: old.id }, data: { canReapply: true } });
      expect((await apply(s)).status).toBe(201);
    });
  });

  describe('documents', () => {
    it("lets the event's organizer open an application document, and no other organizer", async () => {
      const s = await setup();
      const res = await apply(s);
      const doc = await prisma.applicationDocument.findFirstOrThrow({ where: { applicationId: res.body.id } });
      const organizer = await signInAs(app, s.organizer.user.email);
      const stranger = await createOrganizer(prisma);
      const strangerBrowser = await signInAs(app, stranger.user.email);

      expect((await organizer.get(`/api/files/${doc.fileId}`)).status).toBe(302);
      expect((await strangerBrowser.get(`/api/files/${doc.fileId}`)).status).toBe(404);
    });

    it('does not let a document be attached to two applications', async () => {
      const s = await setup();
      const file = await readyFile(prisma, s.vendor.user.id);
      const docs = { documents: [{ requirementId: s.clearance.id, fileIds: [file.id] }] };
      const first = await apply(s, docs);
      await s.browser.post(`/api/vendor/applications/${first.body.id}/withdraw`).send({});

      const res = await apply(s, docs);

      expect(res.status).toBe(400);
    });
  });
});
