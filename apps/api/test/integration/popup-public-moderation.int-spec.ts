import type { INestApplication } from '@nestjs/common';
import { manilaParts } from '@creavent/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { EventStatus, PrismaClient } from '../../src/generated/prisma/client.js';
import { assignedSlot, eventParts } from './applications.js';
import { createTestApp, signInAs } from './app.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { readyEvent } from './events.js';
import { createOrganizer, createUser, createVendor } from './factories.js';

// Features 6.4 and 6.5: pop-ups on the public pages, and their moderation
// (spec §2, §4.7, §7, flows 10 and 11).
describe('pop-ups in public and in moderation', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let preloved: string;

  const day = 86_400_000;
  // 2 PM to 8 PM Manila, `days` from today.
  const on = (days: number) => {
    const startsAt = new Date(`${manilaParts(new Date(Date.now() + days * day)).date}T14:00:00+08:00`);
    return { startsAt, endsAt: new Date(startsAt.getTime() + 6 * 3_600_000) };
  };

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

  const pub = (path: string) => request(app.getHttpServer()).get(`/api/public/${path}`);

  async function host(approval: 'approved' | 'pending_review' = 'approved') {
    const { user, profile } = await createVendor(prisma, [preloved]);
    await prisma.userRole.update({
      where: { userId_role: { userId: user.id, role: 'vendor' } },
      data: { approvalStatus: approval, approvalSource: approval === 'approved' ? 'reviewed' : null, reviewedAt: new Date() },
    });
    return { user, profile };
  }

  let counter = 0;
  async function popup(hostVendorProfileId: string, status: EventStatus = 'announced', overrides: { days?: number; name?: string; hidden?: boolean } = {}) {
    counter += 1;
    const type = await prisma.eventType.findFirstOrThrow({ where: { slug: 'pop-up' } });
    const event = await prisma.event.create({
      data: {
        hostVendorProfileId,
        eventTypeId: type.id,
        name: overrides.name ?? `Lola's Ukay at Habi Café ${counter}`,
        slug: `lolas-ukay-${counter}-${crypto.randomUUID().slice(0, 6)}`,
        description: 'Two racks of preloved tops and denim.',
        ...on(overrides.days ?? 4),
        venueName: 'Habi Café',
        addressLine: 'Quirino Avenue, Obrero',
        city: 'Davao City',
        status,
        applicationsOpen: false,
        announcedAt: status === 'draft' ? null : new Date(),
        canceledAt: status === 'canceled' ? new Date() : null,
        cancelReason: status === 'canceled' ? 'Habi Café is closed for a private event.' : null,
        moderationState: overrides.hidden ? 'hidden' : 'visible',
      },
    });
    return event;
  }

  async function admin() {
    const user = await createUser(prisma, { isAdmin: true });
    return { user, browser: await signInAs(app, user.email) };
  }

  describe('the listing (6.4)', () => {
    it("shows an announced pop-up with the Pop-up type and the host's shop and badge, and finds it by shop name", async () => {
      const { profile } = await host();
      const shown = await popup(profile.id, 'announced', { name: 'Saturday garden sale' });
      await popup(profile.id, 'draft');
      await popup(profile.id, 'announced', { hidden: true });
      const { profile: org } = await createOrganizer(prisma, { displayName: 'Sari-Sari Collective' });
      await readyEvent(prisma, org.id, { status: 'announced', name: 'Matina Night Flea', ...on(5) });

      const all = await pub('events');
      const popups = await pub('events').query({ type: 'pop-up' });
      const byShop = await pub('events').query({ q: 'lola' });

      expect(all.status).toBe(200);
      expect(all.body.events.map((e: { name: string }) => e.name)).toEqual(['Saturday garden sale', 'Matina Night Flea']);
      expect(all.body.events[0]).toMatchObject({ typeName: 'Pop-up', isPopup: true, organizer: { displayName: "Lola's Ukay", approved: true } });
      expect(all.body.types.find((t: { slug: string }) => t.slug === 'pop-up').count).toBe(1);
      expect(popups.body.events.map((e: { slug: string }) => e.slug)).toEqual([shown.slug]);
      expect(byShop.body.events.map((e: { slug: string }) => e.slug)).toEqual([shown.slug]);
    });

    it('hides the badge while host approval is back in review', async () => {
      const { profile } = await host('pending_review');
      await popup(profile.id);

      const res = await pub('events');

      expect(res.body.events[0].organizer).toEqual({ displayName: "Lola's Ukay", approved: false });
    });
  });

  describe('the pop-up page (6.4)', () => {
    it('shows the host block instead of the organizer, with no vendor list', async () => {
      const { profile } = await host();
      await prisma.vendorProfile.update({ where: { id: profile.id }, data: { products: 'Tops, denim', socialLinks: ['https://instagram.com/lolasukay'] } });
      const event = await popup(profile.id);

      const res = await pub(`events/${event.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.page.view).toBe('public');
      expect(res.body.page.event).toMatchObject({
        organizer: null,
        vendors: [],
        host: { shopName: "Lola's Ukay", slug: profile.slug, approved: true, categories: ['Preloved clothing'], products: 'Tops, denim', socialLinks: ['https://instagram.com/lolasukay'], eventsSoldAt: 1 },
      });
      expect(res.body.tags).toEqual(expect.arrayContaining([`event:${event.id}`, `vendor:${profile.id}`]));
    });

    it('is Not found as a draft or hidden to visitors, and shows the host "Manage pop-up"', async () => {
      const { user, profile } = await host();
      const draft = await popup(profile.id, 'draft');
      const hidden = await popup(profile.id, 'announced', { hidden: true });

      expect((await pub(`events/${draft.slug}`)).status).toBe(404);
      expect((await pub(`events/${hidden.slug}`)).status).toBe(404);
      const own = await (await signInAs(app, user.email)).get(`/api/events/${draft.slug}`);
      expect(own.status).toBe(200);
      expect(own.body).toMatchObject({ view: 'public', manage: { eventId: draft.id, popup: true } });
    });

    it('stays up when canceled, with the host note', async () => {
      const { profile } = await host();
      const event = await popup(profile.id, 'canceled');

      const res = await pub(`events/${event.slug}`);

      expect(res.body.page.view).toBe('public');
      expect(res.body.page.event.canceled).toMatchObject({ reason: 'Habi Café is closed for a private event.' });
    });
  });

  describe('the vendor page (6.4)', () => {
    it('lists the next pop-up in "Find them next at", and announced or completed pop-ups in "Where they\'ve sold"', async () => {
      const { profile } = await host();
      const next = await popup(profile.id, 'announced', { days: 3, name: 'Next pop-up' });
      await popup(profile.id, 'completed', { days: -7, name: 'Last pop-up' });
      await popup(profile.id, 'canceled', { days: 10, name: 'Canceled pop-up' });
      await popup(profile.id, 'announced', { days: 12, name: 'Hidden pop-up', hidden: true });
      await popup(profile.id, 'draft', { days: 14, name: 'Draft pop-up' });
      const { user: orgUser, profile: org } = await createOrganizer(prisma);
      const market = await readyEvent(prisma, org.id, { status: 'announced', name: 'Matina Night Flea', ...on(8) });
      const parts = await eventParts(prisma, market);
      const { assignment } = await assignedSlot(prisma, { eventId: market, vendorProfileId: profile.id, categoryId: preloved, slotId: parts.slots[0]!.id, organizerUserId: orgUser.id });
      await prisma.slotAssignment.update({ where: { id: assignment.id }, data: { status: 'reserved' } });

      const res = await pub(`vendors/${profile.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.next).toMatchObject({ event: { slug: next.slug, isPopup: true }, slotLabel: null });
      expect(res.body.sold.map((s: { name: string }) => s.name)).toEqual(['Matina Night Flea', 'Next pop-up', 'Last pop-up']);
      expect(res.body.sold[1]).toMatchObject({ isPopup: true, slotLabel: null, organizerName: "Lola's Ukay" });
      expect(res.body.vendor.eventsSoldAt).toBe(3);
    });
  });

  describe('moderation (6.5)', () => {
    it("shows the host approval on the admin user page, with the announced pop-ups and how it was granted", async () => {
      const { user, profile } = await host();
      await popup(profile.id);
      await popup(profile.id, 'draft');
      const { browser } = await admin();

      const res = await browser.get(`/api/admin/users/${user.id}`);

      expect(res.status).toBe(200);
      expect(res.body.host).toMatchObject({ status: 'approved', source: 'reviewed', revoked: false, announcedPopups: 1 });
      expect(res.body.popups.map((e: { status: string }) => e.status).sort()).toEqual(['announced', 'draft']);
    });

    it('revoke from the user page: rejected with the reason, earned route off, pop-ups hidden, one email', async () => {
      const { user, profile } = await host();
      const a = await popup(profile.id);
      const b = await popup(profile.id, 'announced', { days: 9 });
      const draft = await popup(profile.id, 'draft');
      const { browser } = await admin();

      const res = await browser.post(`/api/admin/users/${user.id}/revoke-host`).send({ reason: "Two visitors reported it didn't take place" });

      expect(res.status).toBe(200);
      expect(res.body.host).toMatchObject({ status: 'rejected', revoked: true, rejectionReason: "Two visitors reported it didn't take place", announcedPopups: 0 });
      const role = await prisma.userRole.findUniqueOrThrow({ where: { userId_role: { userId: user.id, role: 'vendor' } } });
      expect(role.hostRevokedAt).not.toBeNull();
      expect(role.suspendedAt).toBeNull();
      const events = await prisma.event.findMany({ where: { id: { in: [a.id, b.id, draft.id] } }, orderBy: { startsAt: 'asc' } });
      expect(events.filter((e) => e.moderationState === 'hidden').map((e) => e.id).sort()).toEqual([a.id, b.id].sort());
      expect(events.find((e) => e.id === a.id)!.moderationReason).toBe("Two visitors reported it didn't take place");
      expect(await prisma.emailNotification.count({ where: { type: 'host_approval_revoked', userId: user.id } })).toBe(1);
      expect(await prisma.emailNotification.count({ where: { type: 'event_hidden' } })).toBe(0);
      expect(await prisma.auditLog.count({ where: { action: 'host_approval.revoke' } })).toBe(1);
    });

    it('revoke is for admins, and only for an approved host', async () => {
      const { user } = await host('pending_review');
      const { browser } = await admin();
      const vendorBrowser = await signInAs(app, user.email);

      expect((await vendorBrowser.post(`/api/admin/users/${user.id}/revoke-host`).send({ reason: 'x' })).status).toBe(403);
      expect((await browser.post(`/api/admin/users/${user.id}/revoke-host`).send({ reason: ' ' })).status).toBe(400);
      expect((await browser.post(`/api/admin/users/${user.id}/revoke-host`).send({ reason: 'x' })).status).toBe(409);
    });

    it("suspending the vendor role hides their announced pop-ups with no email, and reinstating doesn't show them", async () => {
      const { user, profile } = await host();
      const event = await popup(profile.id);
      const { browser } = await admin();

      await browser.post(`/api/admin/users/${user.id}/roles/vendor/suspend`).send({ reason: 'Scam reports' });
      expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ moderationState: 'hidden', moderationReason: 'Scam reports' });
      await browser.post(`/api/admin/users/${user.id}/roles/vendor/reinstate`).send({});

      expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).moderationState).toBe('hidden');
      expect(await prisma.emailNotification.count({ where: { type: 'event_hidden' } })).toBe(0);
    });

    it("hiding a pop-up from /admin/events emails its host, and the Pop-ups filter lists it with the host", async () => {
      const { user, profile } = await host();
      const event = await popup(profile.id);
      const { profile: org } = await createOrganizer(prisma);
      await readyEvent(prisma, org.id, { status: 'announced', ...on(5) });
      const { browser } = await admin();

      const list = await browser.get('/api/admin/events?filter=popups');
      const hide = await browser.post(`/api/admin/events/${event.id}/hide`).send({ reason: 'Photos from another shop' });

      expect(list.body.items).toEqual([expect.objectContaining({ id: event.id, isPopup: true, organizerName: "Lola's Ukay" })]);
      expect(list.body.counts).toMatchObject({ all: 2, popups: 1 });
      expect(hide.status).toBe(200);
      const email = await prisma.emailNotification.findFirstOrThrow({ where: { type: 'event_hidden' } });
      expect(email.userId).toBe(user.id);
    });

    it('a pop-up report takes "Fake or misleading event", and can revoke host approval', async () => {
      const { user, profile } = await host();
      const event = await popup(profile.id);
      const reporter = await createVendor(prisma, [preloved]);
      const reporterBrowser = await signInAs(app, reporter.user.email);
      const { browser } = await admin();

      const sent = await reporterBrowser.post('/api/reports').send({ targetType: 'event', targetId: event.id, reason: 'fake_or_misleading_event' });
      expect(sent.status).toBe(201);
      const report = await prisma.report.findFirstOrThrow({ where: { targetEventId: event.id } });
      const detail = await browser.get(`/api/admin/reports/${report.id}`);
      expect(detail.body.target.host).toMatchObject({ userId: user.id, approved: true, suspended: false });
      const wrongRole = await browser.post(`/api/admin/reports/${report.id}/resolve`).send({ decision: 'suspend_role', role: 'organizer', reason: 'x' });
      expect(wrongRole.status).toBe(400);

      const res = await browser.post(`/api/admin/reports/${report.id}/resolve`).send({ decision: 'revoke_host', reason: 'The address was a vacant lot' });

      expect(res.status).toBe(200);
      expect(await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).toMatchObject({ status: 'actioned', actionTaken: 'host_approval_revoked' });
      expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).moderationState).toBe('hidden');
      expect((await prisma.userRole.findUniqueOrThrow({ where: { userId_role: { userId: user.id, role: 'vendor' } } })).approvalStatus).toBe('rejected');
    });
  });
});
