import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { agent, createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { readyEvent } from './events.js';
import { createOrganizer, createUser, createVendor } from './factories.js';

// Reports (spec §2.2, flow 11): the report button, reports added from the
// support inbox, and the admin's decision for a group of reports.
describe('reports', () => {
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

  async function announcedEvent(name = 'Black Friday Mega Ukay') {
    const organizer = await createOrganizer(prisma, { displayName: 'Mega Sale DVO' });
    const id = await readyEvent(prisma, organizer.profile.id, { status: 'announced', name });
    const event = await prisma.event.findUniqueOrThrow({ where: { id } });
    return { organizer, event };
  }

  async function vendorBrowser() {
    const vendor = await createVendor(prisma);
    return { vendor, browser: await signInAs(app, vendor.user.email) };
  }

  describe('the report button', () => {
    it('needs a signed-in user', async () => {
      const { event } = await announcedEvent();
      const res = await agent(app).post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam' });
      expect(res.status).toBe(401);
    });

    it('reports an event and gives a reference number', async () => {
      const { event } = await announcedEvent();
      const { vendor, browser } = await vendorBrowser();

      const res = await browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam', details: 'Asked for a GCash deposit' });

      expect(res.status).toBe(201);
      expect(res.body.number).toBe(1);
      const report = await prisma.report.findFirstOrThrow();
      expect(report).toMatchObject({
        source: 'report_button',
        reporterUserId: vendor.user.id,
        targetType: 'event',
        targetEventId: event.id,
        reason: 'scam',
        details: 'Asked for a GCash deposit',
        status: 'open',
      });
    });

    it('reports a vendor or organizer', async () => {
      const { organizer } = await announcedEvent();
      const { browser } = await vendorBrowser();

      const res = await browser.post('/api/reports').send({ targetType: 'organizer', targetId: organizer.profile.id, reason: 'fake_account' });

      expect(res.status).toBe(201);
      expect((await prisma.report.findFirstOrThrow()).targetUserId).toBe(organizer.user.id);
    });

    it('takes one open report per person about the same thing', async () => {
      const { event } = await announcedEvent();
      const { browser } = await vendorBrowser();
      await browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam' });

      const again = await browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'other' });

      expect(again.status).toBe(409);
      expect(again.body.message).toContain('RPT-0001');
      expect(await prisma.report.count()).toBe(1);
    });

    it("can't report yourself or your own event", async () => {
      const { organizer, event } = await announcedEvent();
      const browser = await signInAs(app, organizer.user.email);

      expect((await browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam' })).status).toBe(400);
      expect((await browser.post('/api/reports').send({ targetType: 'organizer', targetId: organizer.profile.id, reason: 'scam' })).status).toBe(400);
    });

    it('only reports what people can see: not drafts, user ids, or pages that are down', async () => {
      const organizer = await createOrganizer(prisma);
      const draft = await readyEvent(prisma, organizer.profile.id);
      const suspended = await createOrganizer(prisma, { suspendedAt: new Date() });
      const deleted = await createVendor(prisma);
      await prisma.user.update({ where: { id: deleted.user.id }, data: { deletedAt: new Date() } });
      const { browser } = await vendorBrowser();
      const send = (targetType: string, targetId: string) => browser.post('/api/reports').send({ targetType, targetId, reason: 'scam' });

      expect((await send('event', draft)).status).toBe(404);
      // People are reported through their public page, never by user id.
      expect((await send('user', organizer.user.id)).status).toBe(400);
      expect((await send('organizer', suspended.profile.id)).status).toBe(404);
      expect((await send('vendor', deleted.profile.id)).status).toBe(404);
      expect(await prisma.report.count()).toBe(0);
    });

    it("public pages carry the event and profile ids the report link needs, never a user id", async () => {
      const { organizer, event } = await announcedEvent();
      const vendor = await createVendor(prisma);
      const org = await prisma.organizerProfile.findUniqueOrThrow({ where: { id: organizer.profile.id } });
      const shop = await prisma.vendorProfile.findUniqueOrThrow({ where: { id: vendor.profile.id } });

      const pages = [
        await agent(app).get(`/api/public/events/${event.slug}`),
        await agent(app).get(`/api/public/organizers/${org.slug}`),
        await agent(app).get(`/api/public/vendors/${shop.slug}`),
      ];

      expect(pages.map((p) => p.status)).toEqual([200, 200, 200]);
      for (const p of pages) {
        expect(JSON.stringify(p.body)).not.toContain(organizer.user.id);
        expect(JSON.stringify(p.body)).not.toContain(vendor.user.id);
      }
      expect(pages[0]!.body.page.event.id).toBe(event.id);
      expect(pages[1]!.body.organizer.id).toBe(organizer.profile.id);
      expect(pages[2]!.body.vendor.id).toBe(vendor.profile.id);
    });

    it("tells the page whether the viewer owns it, so it doesn't offer a report", async () => {
      const { organizer, event } = await announcedEvent();
      const browser = await signInAs(app, organizer.user.email);

      const own = await browser.get(`/api/reports/mine?targetType=event&targetId=${event.id}`);
      const page = await browser.get(`/api/reports/mine?targetType=organizer&targetId=${organizer.profile.id}`);

      expect(own.body).toEqual({ number: null, own: true });
      expect(page.body).toEqual({ number: null, own: true });
    });

    it('takes at most 10 reports per person an hour', async () => {
      const { browser } = await vendorBrowser();
      const targets = await Promise.all(Array.from({ length: 11 }, () => createVendor(prisma)));

      const statuses: number[] = [];
      for (const t of targets) statuses.push((await browser.post('/api/reports').send({ targetType: 'vendor', targetId: t.profile.id, reason: 'scam' })).status);

      expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
      expect(statuses[10]).toBe(429);
      expect(await prisma.report.count()).toBe(10);
    });

    it("tells the viewer they already reported something while it's open", async () => {
      const { event } = await announcedEvent();
      const { browser } = await vendorBrowser();

      const before = await browser.get(`/api/reports/mine?targetType=event&targetId=${event.id}`);
      await browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam' });
      const after = await browser.get(`/api/reports/mine?targetType=event&targetId=${event.id}`);

      expect(before.body).toEqual({ number: null, own: false });
      expect(after.body).toEqual({ number: 1, own: false });
    });
  });

  describe('admin', () => {
    it('is only for admins, on every route', async () => {
      const notAdmin = await signInAs(app, (await createUser(prisma)).email);
      const { event } = await announcedEvent();
      await (await vendorBrowser()).browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam' });
      const id = (await prisma.report.findFirstOrThrow()).id;
      const routes: [string, string][] = [
        ['get', '/api/admin/reports'],
        ['post', '/api/admin/reports'],
        ['get', `/api/admin/reports/${id}`],
        ['post', `/api/admin/reports/${id}/resolve`],
      ];

      for (const [method, path] of routes) {
        expect((await agent(app)[method as 'get'](path).send({ decision: 'dismiss' })).status, `${method} ${path} signed out`).toBe(401);
        expect((await notAdmin[method as 'get'](path).send({ decision: 'dismiss' })).status, `${method} ${path} not admin`).toBe(403);
      }
      expect((await prisma.report.findFirstOrThrow()).status).toBe('open');
    });

    it('the report button and its status need a signed-in user', async () => {
      const { event } = await announcedEvent();
      expect((await agent(app).get(`/api/reports/mine?targetType=event&targetId=${event.id}`)).status).toBe(401);
    });

    it('adds a report from a support email', async () => {
      const { user: adminUser, browser } = await admin();
      const { event } = await announcedEvent();

      const res = await browser
        .post('/api/admin/reports')
        .send({ reporterEmail: 'visitor@example.com', targetType: 'event', targetId: event.id, reason: 'scam', details: 'Paid a reservation fee' });

      expect(res.status).toBe(201);
      expect(await prisma.report.findFirstOrThrow()).toMatchObject({
        source: 'support_email',
        reporterUserId: null,
        reporterEmail: 'visitor@example.com',
        createdById: adminUser.id,
        details: 'Paid a reservation fee',
      });
    });

    it('groups open reports by what they are about, oldest first', async () => {
      const { browser } = await admin();
      const first = await announcedEvent('First Flea');
      const second = await announcedEvent('Second Flea');
      const a = await vendorBrowser();
      const b = await vendorBrowser();
      await a.browser.post('/api/reports').send({ targetType: 'event', targetId: first.event.id, reason: 'scam' });
      await b.browser.post('/api/reports').send({ targetType: 'event', targetId: second.event.id, reason: 'other' });
      await b.browser.post('/api/reports').send({ targetType: 'event', targetId: first.event.id, reason: 'fake_account' });

      const res = await browser.get('/api/admin/reports?status=open');

      expect(res.status).toBe(200);
      expect(res.body.openCount).toBe(2);
      expect(res.body.items.map((g: { target: { name: string }; count: number }) => [g.target.name, g.count])).toEqual([
        ['First Flea', 2],
        ['Second Flea', 1],
      ]);
      expect(res.body.items[0].reasons).toEqual(['scam', 'fake_account']);
    });

    it('shows every open report in the group on its page', async () => {
      const { browser } = await admin();
      const { organizer, event } = await announcedEvent();
      const a = await vendorBrowser();
      await a.browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam', details: 'Deposit to GCash' });
      await browser.post('/api/admin/reports').send({ reporterEmail: 'visitor@example.com', targetType: 'event', targetId: event.id, reason: 'fake_account', details: 'Copied photos' });
      const id = (await prisma.report.findFirstOrThrow({ where: { number: 1 } })).id;
      const second = (await prisma.report.findFirstOrThrow({ where: { number: 2 } })).id;

      const res = await browser.get(`/api/admin/reports/${second}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.target).toMatchObject({ type: 'event', name: 'Black Friday Mega Ukay', hidden: false, organizer: { userId: organizer.user.id, name: 'Mega Sale DVO' } });
      expect(res.body.reports.map((r: { number: number; source: string }) => [r.number, r.source])).toEqual([
        [1, 'report_button'],
        [2, 'support_email'],
      ]);
      expect(res.body.reports[1]).toMatchObject({ reporter: 'visitor@example.com', addedBy: 'Mika Admin' });
    });

    it('dismisses the whole group with a note, and logs it', async () => {
      const { user: adminUser, browser } = await admin();
      const { event } = await announcedEvent();
      await (await vendorBrowser()).browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam' });
      await (await vendorBrowser()).browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam' });
      const id = (await prisma.report.findFirstOrThrow({ where: { number: 1 } })).id;

      const res = await browser.post(`/api/admin/reports/${id}/resolve`).send({ decision: 'dismiss', note: 'Venue booking checked' });

      expect(res.status).toBe(200);
      const reports = await prisma.report.findMany();
      expect(reports.every((r) => r.status === 'dismissed' && r.actionTaken === 'none' && r.resolvedById === adminUser.id)).toBe(true);
      expect(reports[0]!.resolutionNote).toBe('Venue booking checked');
      expect(await prisma.auditLog.count({ where: { action: 'report.resolve' } })).toBe(2);
      expect(await prisma.emailNotification.count()).toBe(0);
      expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).moderationState).toBe('visible');
    });

    it('hides the event: the reason is emailed to the organizer', async () => {
      const { browser } = await admin();
      const { organizer, event } = await announcedEvent();
      await (await vendorBrowser()).browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam' });
      const id = (await prisma.report.findFirstOrThrow()).id;

      const res = await browser.post(`/api/admin/reports/${id}/resolve`).send({ decision: 'hide_event', reason: 'Photos match another event' });

      expect(res.status).toBe(200);
      expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ moderationState: 'hidden', moderationReason: 'Photos match another event' });
      expect(await prisma.report.findFirstOrThrow()).toMatchObject({ status: 'actioned', actionTaken: 'event_hidden' });
      const email = await prisma.emailNotification.findFirstOrThrow({ where: { type: 'event_hidden' } });
      expect(email.userId).toBe(organizer.user.id);
      expect(email.payload).toMatchObject({ reason: 'Photos match another event', eventName: 'Black Friday Mega Ukay' });
      expect(await prisma.auditLog.count({ where: { action: 'event.hide' } })).toBe(1);
      expect((await agent(app).get(`/api/public/events/${event.slug}`)).status).toBe(404);
    });

    it("suspends the organizer from an event report, and a user's role from a user report", async () => {
      const { browser } = await admin();
      const { organizer, event } = await announcedEvent();
      const reported = await createVendor(prisma);
      const reporter = await vendorBrowser();
      await reporter.browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam' });
      await reporter.browser.post('/api/reports').send({ targetType: 'vendor', targetId: reported.profile.id, reason: 'scam' });
      const [eventReport, userReport] = await prisma.report.findMany({ orderBy: { number: 'asc' } });

      const a = await browser.post(`/api/admin/reports/${eventReport!.id}/resolve`).send({ decision: 'suspend_role', role: 'organizer', reason: 'Took deposits and stopped replying' });
      const b = await browser.post(`/api/admin/reports/${userReport!.id}/resolve`).send({ decision: 'suspend_role', role: 'vendor', reason: "Didn't attend after a deposit" });

      expect([a.status, b.status]).toEqual([200, 200]);
      expect(await prisma.userRole.findUniqueOrThrow({ where: { userId_role: { userId: organizer.user.id, role: 'organizer' } } })).toMatchObject({
        suspensionReason: 'Took deposits and stopped replying',
      });
      expect((await prisma.userRole.findUniqueOrThrow({ where: { userId_role: { userId: reported.user.id, role: 'vendor' } } })).suspendedAt).not.toBeNull();
      expect(await prisma.report.count({ where: { actionTaken: 'user_suspended' } })).toBe(2);
      expect(await prisma.auditLog.count({ where: { action: 'user_role.suspend' } })).toBe(2);
    });

    it("suspending the organizer from a report can also hide their upcoming events", async () => {
      const { browser } = await admin();
      const { organizer, event } = await announcedEvent();
      const other = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors' });
      await (await vendorBrowser()).browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam' });
      const id = (await prisma.report.findFirstOrThrow()).id;

      const res = await browser.post(`/api/admin/reports/${id}/resolve`).send({ decision: 'suspend_role', role: 'organizer', reason: 'Scam', hideUpcomingEvents: true });

      expect(res.status).toBe(200);
      expect(await prisma.event.count({ where: { id: { in: [event.id, other] }, moderationState: 'hidden' } })).toBe(2);
    });

    it('records a decision whose action is already in place, without doing it again', async () => {
      const { browser } = await admin();
      const { event } = await announcedEvent();
      await (await vendorBrowser()).browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam' });
      const id = (await prisma.report.findFirstOrThrow()).id;
      await browser.post(`/api/admin/events/${event.id}/hide`).send({ reason: 'Hidden from the events page' });

      const res = await browser.post(`/api/admin/reports/${id}/resolve`).send({ decision: 'hide_event', reason: 'Same reason' });

      expect(res.status).toBe(200);
      expect(await prisma.report.findFirstOrThrow()).toMatchObject({ status: 'actioned', actionTaken: 'event_hidden' });
      expect(await prisma.emailNotification.count({ where: { type: 'event_hidden' } })).toBe(1);
      expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).moderationReason).toBe('Hidden from the events page');
    });

    it('refuses decisions that make no sense for the report', async () => {
      const { browser } = await admin();
      const reported = await createVendor(prisma);
      await (await vendorBrowser()).browser.post('/api/reports').send({ targetType: 'vendor', targetId: reported.profile.id, reason: 'scam' });
      const id = (await prisma.report.findFirstOrThrow()).id;

      expect((await browser.post(`/api/admin/reports/${id}/resolve`).send({ decision: 'hide_event', reason: 'x' })).status).toBe(400);
      expect((await browser.post(`/api/admin/reports/${id}/resolve`).send({ decision: 'suspend_role', role: 'organizer', reason: 'x' })).status).toBe(400);
      expect((await browser.post(`/api/admin/reports/${id}/resolve`).send({ decision: 'suspend_role', role: 'vendor' })).status).toBe(400);
      expect((await prisma.report.findFirstOrThrow()).status).toBe('open');
    });

    it('resolves a group only once, and lists it under Resolved', async () => {
      const { browser } = await admin();
      const { event } = await announcedEvent();
      await (await vendorBrowser()).browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam' });
      const id = (await prisma.report.findFirstOrThrow()).id;
      await browser.post(`/api/admin/reports/${id}/resolve`).send({ decision: 'dismiss' });

      const again = await browser.post(`/api/admin/reports/${id}/resolve`).send({ decision: 'dismiss' });
      const resolved = await browser.get('/api/admin/reports?status=resolved');
      const detail = await browser.get(`/api/admin/reports/${id}`);

      expect(again.status).toBe(409);
      expect(resolved.body.items).toHaveLength(1);
      expect(resolved.body.items[0]).toMatchObject({ status: 'dismissed', actionTaken: 'none', count: 1 });
      expect(detail.body).toMatchObject({ status: 'dismissed', resolvedByName: 'Mika Admin' });
    });

    it('a report about the same thing after a decision starts a new group', async () => {
      const { browser } = await admin();
      const { event } = await announcedEvent();
      const reporter = await vendorBrowser();
      await reporter.browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam' });
      await browser.post(`/api/admin/reports/${(await prisma.report.findFirstOrThrow()).id}/resolve`).send({ decision: 'dismiss' });

      const again = await reporter.browser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'scam' });
      const open = await browser.get('/api/admin/reports?status=open');

      expect(again.status).toBe(201);
      expect(open.body.items).toHaveLength(1);
      expect(open.body.items[0].count).toBe(1);
    });
  });
});
