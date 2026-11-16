import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PublicRefreshService } from '../../src/public/public-refresh.service.js';
import { createTestApp, signInAs } from './app.js';
import { assignedSlot, eventParts } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createUser, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// Decision Q1: changes that show on public pages ask the web app to refresh
// exactly those pages, after the change is saved.
describe('refreshing public pages', () => {
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let refresh: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    app = await createTestApp();
    refresh = vi.spyOn(app.get(PublicRefreshService), 'refresh').mockResolvedValue();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function setup() {
    const organizer = await createOrganizer(prisma);
    const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors' });
    return { organizer, eventId, browser: await signInAs(app, organizer.user.email) };
  }

  it('refreshes the listing and the event when it is announced, the announcement is undone, or it is canceled', async () => {
    const { eventId, browser } = await setup();

    await browser.post(`/api/organizer/events/${eventId}/announce`).send({});
    expect(refresh).toHaveBeenLastCalledWith(['listing', `event:${eventId}`]);

    await browser.post(`/api/organizer/events/${eventId}/undo-announce`).send({});
    expect(refresh).toHaveBeenLastCalledWith(['listing', `event:${eventId}`]);

    await browser.post(`/api/organizer/events/${eventId}/cancel`).send({});
    expect(refresh).toHaveBeenLastCalledWith(['listing', `event:${eventId}`]);
  });

  it('refreshes nothing when a refused change saves nothing', async () => {
    const { organizer, browser } = await setup();
    const draft = await readyEvent(prisma, organizer.profile.id);

    await browser.post(`/api/organizer/events/${draft}/announce`).send({});

    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes the event and the vendor page when a payment is approved, and when the vendor is removed', async () => {
    const { organizer, eventId, browser } = await setup();
    const parts = await eventParts(prisma, eventId);
    const vendor = await createVendor(prisma, [parts.preloved.id]);
    const slot = await assignedSlot(prisma, { eventId, vendorProfileId: vendor.profile.id, categoryId: parts.preloved.id, slotId: parts.slots[0]!.id, organizerUserId: organizer.user.id });

    await browser.post(`/api/organizer/events/${eventId}/assignments/${slot.assignment.id}/mark-paid`).send({ note: 'Paid in cash at the office', method: 'cash' });
    expect(refresh).toHaveBeenLastCalledWith([`event:${eventId}`, `vendor:${vendor.profile.id}`]);

    await browser.post(`/api/organizer/events/${eventId}/applications/${slot.application.id}/remove`).send({ canReapply: true });
    expect(refresh).toHaveBeenLastCalledWith([`event:${eventId}`, `vendor:${vendor.profile.id}`]);
  });

  it('refreshes the organizer pages when the organizer is approved', async () => {
    const pending = await createOrganizer(prisma, { approvalStatus: 'pending_review', displayName: 'Mintal Market' });
    await prisma.organizerProfile.update({ where: { id: pending.profile.id }, data: { socialLinks: ['https://facebook.com/a'] } });
    const admin = await createUser(prisma, { isAdmin: true });
    const browser = await signInAs(app, admin.email);

    const res = await browser.post(`/api/admin/approvals/${pending.user.id}/approve`).send({ seen: { displayName: 'Mintal Market', socialLinks: ['https://facebook.com/a'] } });

    expect(res.status).toBe(200);
    expect(refresh).toHaveBeenLastCalledWith([`organizer:${pending.profile.id}`, 'listing']);
  });
});
