import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { agent, createTestApp, signInAs } from './app.js';
import { assignedSlot, eventParts, readyFile, submittedApplication } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { readyEvent } from './events.js';
import { addRole, createOrganizer, createUser, createVendor } from './factories.js';

// Admin users and events (spec §2, sitemap §6, flow 11): search, suspend and
// reinstate each role, hide and show events, and logged document views.
describe('admin users and events', () => {
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
    const user = await createUser(prisma, { isAdmin: true, fullName: 'Mika Admin' });
    return { user, browser: await signInAs(app, user.email) };
  }

  const role = (userId: string, r: 'vendor' | 'organizer') => prisma.userRole.findUniqueOrThrow({ where: { userId_role: { userId, role: r } } });

  it('is only for admins', async () => {
    const notAdmin = await signInAs(app, (await createUser(prisma)).email);
    const vendor = await createVendor(prisma);

    const organizer = await createOrganizer(prisma);
    const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'announced' });
    const routes: [string, string][] = [
      ['get', '/api/admin/users'],
      ['get', `/api/admin/users/${vendor.user.id}`],
      ['post', `/api/admin/users/${vendor.user.id}/roles/vendor/suspend`],
      ['post', `/api/admin/users/${vendor.user.id}/roles/vendor/reinstate`],
      ['get', '/api/admin/events'],
      ['get', `/api/admin/events/${eventId}`],
      ['post', `/api/admin/events/${eventId}/hide`],
      ['post', `/api/admin/events/${eventId}/show`],
      ['get', '/api/admin/search?q=a'],
    ];

    for (const [method, path] of routes) {
      expect((await agent(app)[method as 'get'](path).send({ reason: 'x' })).status, `${method} ${path} signed out`).toBe(401);
      expect((await notAdmin[method as 'get'](path).send({ reason: 'x' })).status, `${method} ${path} not admin`).toBe(403);
    }
    expect((await role(vendor.user.id, 'vendor')).suspendedAt).toBeNull();
    expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).moderationState).toBe('visible');
  });

  describe('users', () => {
    it('lists users with their roles, filtered and searched', async () => {
      const { browser } = await admin();
      const vendor = await createVendor(prisma);
      await prisma.user.update({ where: { id: vendor.user.id }, data: { fullName: 'Jun Reyes' } });
      const organizer = await createOrganizer(prisma, { displayName: 'Mega Sale DVO' });
      await addRole(prisma, organizer.user.id, 'vendor', { suspendedAt: new Date() });

      const all = await browser.get('/api/admin/users');
      const suspended = await browser.get('/api/admin/users?filter=suspended');
      const found = await browser.get('/api/admin/users?q=jun');

      expect(all.status).toBe(200);
      // Admins without roles aren't listed.
      expect(all.body.total).toBe(2);
      expect(all.body.counts).toEqual({ all: 2, vendors: 2, organizers: 1, suspended: 1 });
      expect(suspended.body.items.map((u: { id: string }) => u.id)).toEqual([organizer.user.id]);
      expect(found.body.items).toHaveLength(1);
      expect(found.body.items[0]).toMatchObject({ fullName: 'Jun Reyes', roles: [{ role: 'vendor', name: "Lola's Ukay", suspended: false }] });
    });

    it('refuses a page number past any real list', async () => {
      const { browser } = await admin();
      expect((await browser.get('/api/admin/users?page=1000000000')).status).toBe(400);
      expect((await browser.get('/api/admin/events?page=1000000000')).status).toBe(400);
    });

    it('shows a user with contact details, roles, activity, reports and history', async () => {
      const { browser } = await admin();
      const organizer = await createOrganizer(prisma, { displayName: 'Mega Sale DVO' });
      await readyEvent(prisma, organizer.profile.id, { status: 'announced', name: 'Black Friday Mega Ukay' });
      const reporter = await signInAs(app, (await createVendor(prisma)).user.email);
      await reporter.post('/api/reports').send({ targetType: 'organizer', targetId: organizer.profile.id, reason: 'scam' });

      const res = await browser.get(`/api/admin/users/${organizer.user.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        email: organizer.user.email,
        phone: '+639171234567',
        roles: [{ role: 'organizer', name: 'Mega Sale DVO', approvalStatus: 'approved', suspended: false, upcomingEvents: 1 }],
        events: [{ name: 'Black Friday Mega Ukay', status: 'announced', hidden: false }],
        reports: [{ number: 1, reason: 'scam', open: true }],
      });
      expect(res.body.history.map((h: { text: string }) => h.text)).toContain('Report RPT-0001 from the report button');
    });

    it('suspends one role with a reason the user sees; the other role keeps working', async () => {
      const { user: adminUser, browser } = await admin();
      const organizer = await createOrganizer(prisma);
      await addRole(prisma, organizer.user.id, 'vendor');

      const res = await browser.post(`/api/admin/users/${organizer.user.id}/roles/vendor/suspend`).send({ reason: 'Took a deposit and left' });

      expect(res.status).toBe(200);
      expect(await role(organizer.user.id, 'vendor')).toMatchObject({ suspendedById: adminUser.id, suspensionReason: 'Took a deposit and left' });
      expect((await role(organizer.user.id, 'organizer')).suspendedAt).toBeNull();
      expect(await prisma.auditLog.findFirstOrThrow()).toMatchObject({ action: 'user_role.suspend', reason: 'Took a deposit and left' });
      const me = await (await signInAs(app, organizer.user.email)).get('/api/me');
      expect(me.body.roles.find((r: { role: string }) => r.role === 'vendor')).toMatchObject({ suspended: true, suspensionReason: 'Took a deposit and left' });
    });

    it('needs a reason, and refuses a role the user lacks or one already suspended', async () => {
      const { browser } = await admin();
      const vendor = await createVendor(prisma);

      expect((await browser.post(`/api/admin/users/${vendor.user.id}/roles/vendor/suspend`).send({ reason: ' ' })).status).toBe(400);
      expect((await browser.post(`/api/admin/users/${vendor.user.id}/roles/organizer/suspend`).send({ reason: 'x' })).status).toBe(404);
      await browser.post(`/api/admin/users/${vendor.user.id}/roles/vendor/suspend`).send({ reason: 'x' });
      expect((await browser.post(`/api/admin/users/${vendor.user.id}/roles/vendor/suspend`).send({ reason: 'x' })).status).toBe(409);
    });

    it("suspending an organizer can hide their upcoming events, and emails them for each", async () => {
      const { browser } = await admin();
      const organizer = await createOrganizer(prisma);
      const upcoming = await readyEvent(prisma, organizer.profile.id, { status: 'announced' });
      const draft = await readyEvent(prisma, organizer.profile.id);
      const past = await readyEvent(prisma, organizer.profile.id, { status: 'completed', startsAt: new Date('2025-01-01T09:00:00Z'), endsAt: new Date('2025-01-01T15:00:00Z') });

      const res = await browser.post(`/api/admin/users/${organizer.user.id}/roles/organizer/suspend`).send({ reason: 'Scam reports', hideUpcomingEvents: true });

      expect(res.status).toBe(200);
      const states = await prisma.event.findMany({ where: { id: { in: [upcoming, draft, past] } }, select: { id: true, moderationState: true } });
      // Drafts aren't public, so they stay as they are.
      expect(Object.fromEntries(states.map((s) => [s.id, s.moderationState]))).toEqual({ [upcoming]: 'hidden', [draft]: 'visible', [past]: 'visible' });
      expect(await prisma.emailNotification.count({ where: { type: 'event_hidden' } })).toBe(1);
    });

    it('reinstates a suspended role', async () => {
      const { browser } = await admin();
      const vendor = await createVendor(prisma);
      await browser.post(`/api/admin/users/${vendor.user.id}/roles/vendor/suspend`).send({ reason: 'x' });

      const res = await browser.post(`/api/admin/users/${vendor.user.id}/roles/vendor/reinstate`).send({});
      const again = await browser.post(`/api/admin/users/${vendor.user.id}/roles/vendor/reinstate`).send({});

      expect(res.status).toBe(200);
      expect(await role(vendor.user.id, 'vendor')).toMatchObject({ suspendedAt: null, suspensionReason: null });
      expect(again.status).toBe(409);
      expect(await prisma.auditLog.count({ where: { action: 'user_role.reinstate' } })).toBe(1);
    });
  });

  describe('what a suspended role can still do', () => {
    it('a suspended vendor still sees their applications but cannot apply or change them', async () => {
      const organizer = await createOrganizer(prisma);
      const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors' });
      const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
      const parts = await eventParts(prisma, eventId);
      const vendor = await createVendor(prisma);
      const application = await submittedApplication(prisma, { eventId, vendorProfileId: vendor.profile.id, categoryId: parts.preloved.id });
      await prisma.userRole.update({ where: { userId_role: { userId: vendor.user.id, role: 'vendor' } }, data: { suspendedAt: new Date() } });
      const browser = await signInAs(app, vendor.user.email);

      expect((await browser.get('/api/vendor/dashboard')).status).toBe(200);
      expect((await browser.get('/api/vendor/events')).status).toBe(200);
      expect((await browser.get('/api/vendor/applications')).status).toBe(200);
      expect((await browser.get(`/api/vendor/applications/${application.id}`)).status).toBe(200);
      expect((await browser.get(`/api/vendor/events/${event.slug}/apply`)).status).toBe(403);
      expect((await browser.post(`/api/vendor/applications/${application.id}/withdraw`).send({})).status).toBe(403);
    });

    it('a suspended organizer still sees their events but cannot change them', async () => {
      const organizer = await createOrganizer(prisma, { suspendedAt: new Date() });
      const eventId = await readyEvent(prisma, organizer.profile.id);
      const browser = await signInAs(app, organizer.user.email);

      expect((await browser.get('/api/organizer/events')).status).toBe(200);
      expect((await browser.get(`/api/organizer/events/${eventId}`)).status).toBe(200);
      expect((await browser.get(`/api/organizer/events/${eventId}/applications`)).status).toBe(200);
      expect((await browser.post(`/api/organizer/events/${eventId}/open`).send({})).status).toBe(403);
    });
  });

  describe('a hidden event', () => {
    it("tells the organizer why, and the vendor that it's hidden, and blocks the vendor's changes", async () => {
      const { browser } = await admin();
      const organizer = await createOrganizer(prisma);
      const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'announced' });
      const parts = await eventParts(prisma, eventId);
      const vendor = await createVendor(prisma);
      const { application } = await assignedSlot(prisma, { eventId, vendorProfileId: vendor.profile.id, categoryId: parts.preloved.id, slotId: parts.slots[0]!.id, organizerUserId: organizer.user.id });
      await browser.post(`/api/admin/events/${eventId}/hide`).send({ reason: 'Photos match another event' });
      const organizerBrowser = await signInAs(app, organizer.user.email);
      const vendorBrowser = await signInAs(app, vendor.user.email);

      const setup = await organizerBrowser.get(`/api/organizer/events/${eventId}`);
      const detail = await vendorBrowser.get(`/api/vendor/applications/${application.id}`);
      const release = await vendorBrowser.post(`/api/vendor/applications/${application.id}/release`).send({});
      const withdraw = await vendorBrowser.post(`/api/vendor/applications/${application.id}/withdraw`).send({});

      expect(setup.body.hiddenByCreavent).toEqual({ reason: 'Photos match another event' });
      expect(detail.status).toBe(200);
      expect(detail.body.event.hidden).toBe(true);
      expect(release.status).toBe(409);
      expect(withdraw.status).toBe(409);
      expect(release.body.message).toBe('This event is hidden by Creavent');
    });

    it("refuses the organizer's changes too, until it's shown again", async () => {
      const { browser } = await admin();
      const organizer = await createOrganizer(prisma);
      const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors' });
      await browser.post(`/api/admin/events/${eventId}/hide`).send({ reason: 'Photos match another event' });
      const organizerBrowser = await signInAs(app, organizer.user.email);

      const policy = await organizerBrowser.put(`/api/organizer/events/${eventId}/policy`).send({ text: 'New policy' });
      const close = await organizerBrowser.put(`/api/organizer/events/${eventId}/applications`).send({ open: false });
      const cancel = await organizerBrowser.post(`/api/organizer/events/${eventId}/cancel`).send({});

      expect([policy.status, close.status, cancel.status]).toEqual([409, 409, 409]);
      expect(policy.body.message).toBe('This event is hidden by Creavent');
      expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).status).toBe('open_to_vendors');

      await browser.post(`/api/admin/events/${eventId}/show`).send({});
      expect((await organizerBrowser.put(`/api/organizer/events/${eventId}/applications`).send({ open: false })).status).toBe(200);
    });
  });

  describe('events', () => {
    async function eventWithApplications() {
      const organizer = await createOrganizer(prisma, { displayName: 'Mega Sale DVO' });
      const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'announced', name: 'Black Friday Mega Ukay' });
      const parts = await eventParts(prisma, eventId);
      const vendor = await createVendor(prisma);
      const { application, payment } = await assignedSlot(prisma, {
        eventId,
        vendorProfileId: vendor.profile.id,
        categoryId: parts.preloved.id,
        slotId: parts.slots[0]!.id,
        organizerUserId: organizer.user.id,
      });
      const doc = await readyFile(prisma, vendor.user.id);
      await prisma.applicationDocument.create({ data: { applicationId: application.id, requirementId: parts.clearance!.id, fileId: doc.id } });
      const proofFile = await readyFile(prisma, vendor.user.id, 'payment_proof');
      const method = await prisma.eventPaymentMethod.findFirstOrThrow({ where: { eventId } });
      await prisma.paymentProof.create({
        data: { paymentId: payment.id, eventId, vendorProfileId: vendor.profile.id, uploadedById: vendor.user.id, fileId: proofFile.id, paymentMethodId: method.id },
      });
      const other = await createVendor(prisma);
      await submittedApplication(prisma, { eventId, vendorProfileId: other.profile.id, categoryId: parts.preloved.id });
      return { organizer, eventId, vendor, doc, proofFile, slotLabel: parts.slots[0]!.label };
    }

    it('lists every event, drafts and hidden ones included, with filters', async () => {
      const { browser } = await admin();
      const organizer = await createOrganizer(prisma, { displayName: 'Mega Sale DVO' });
      await readyEvent(prisma, organizer.profile.id, { name: 'A Draft' });
      await readyEvent(prisma, organizer.profile.id, { status: 'announced', name: 'B Announced', moderationState: 'hidden' });
      await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors', name: 'C Open' });

      const all = await browser.get('/api/admin/events');
      const hidden = await browser.get('/api/admin/events?filter=hidden');
      const found = await browser.get('/api/admin/events?q=announced');

      expect(all.body.total).toBe(3);
      expect(all.body.counts).toMatchObject({ all: 3, drafts: 1, open: 1, announced: 1, hidden: 1, reported: 0 });
      expect(hidden.body.items.map((e: { name: string }) => e.name)).toEqual(['B Announced']);
      expect(found.body.items[0]).toMatchObject({ name: 'B Announced', organizerName: 'Mega Sale DVO', status: 'announced', hidden: true });
    });

    it('shows an event with its organizer, slots, applications and their files', async () => {
      const { browser } = await admin();
      const { organizer, eventId, doc, proofFile, slotLabel } = await eventWithApplications();

      const res = await browser.get(`/api/admin/events/${eventId}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        name: 'Black Friday Mega Ukay',
        hidden: false,
        organizer: { userId: organizer.user.id, name: 'Mega Sale DVO', approved: true, suspended: false },
        slots: { assigned: 1, reserved: 0 },
        openReports: { count: 0, reportId: null },
      });
      const withSlot = res.body.applications.find((a: { slotLabels: string[] }) => a.slotLabels.length > 0);
      expect(withSlot).toMatchObject({ slotLabels: [slotLabel], documents: [{ fileId: doc.id }], proofs: [{ fileId: proofFile.id }] });
      expect(res.body.applications).toHaveLength(2);
    });

    it('hides an event with a reason emailed to the organizer, and shows it again', async () => {
      const { browser } = await admin();
      const { eventId } = await eventWithApplications();

      const hide = await browser.post(`/api/admin/events/${eventId}/hide`).send({ reason: 'Photos match another event' });
      const detail = await browser.get(`/api/admin/events/${eventId}`);
      const show = await browser.post(`/api/admin/events/${eventId}/show`).send({});

      expect(hide.status).toBe(200);
      expect(detail.body).toMatchObject({ hidden: true, moderationReason: 'Photos match another event', moderatedByName: 'Mika Admin' });
      expect(await prisma.emailNotification.count({ where: { type: 'event_hidden' } })).toBe(1);
      expect(show.status).toBe(200);
      expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).moderationState).toBe('visible');
      expect((await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } })).map((l) => l.action)).toEqual(['event.hide', 'event.show']);
    });

    it("logs each admin view of an application document or proof of payment, but not the uploader's own", async () => {
      const { user: adminUser, browser } = await admin();
      const { vendor, doc, proofFile } = await eventWithApplications();

      expect((await browser.get(`/api/files/${doc.id}`)).status).toBe(302);
      expect((await browser.get(`/api/files/${proofFile.id}`)).status).toBe(302);
      await (await signInAs(app, vendor.user.email)).get(`/api/files/${doc.id}`);

      const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
      expect(logs.map((l) => [l.actorUserId, l.action, l.entityId])).toEqual([
        [adminUser.id, 'application_document.view', doc.id],
        [adminUser.id, 'payment_proof.view', proofFile.id],
      ]);
    });

    it('shows document views in the event history', async () => {
      const { browser } = await admin();
      const { eventId, doc } = await eventWithApplications();
      await browser.get(`/api/files/${doc.id}`);

      // The retention job later deletes the document; the view stays in the history.
      await prisma.applicationDocument.deleteMany({ where: { fileId: doc.id } });

      const res = await browser.get(`/api/admin/events/${eventId}`);

      expect(res.body.history.map((h: { text: string }) => h.text)).toContain("Mika Admin viewed Lola's Ukay's application document");
    });
  });
});
