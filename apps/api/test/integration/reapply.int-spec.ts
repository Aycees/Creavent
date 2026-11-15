import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, signInAs } from './app.js';
import { eventParts, readyFile, submittedApplication } from './applications.js';
import { createTestPrisma, resetDatabase } from './db.js';
import { createOrganizer, createVendor } from './factories.js';
import { readyEvent } from './events.js';

// Feature 3.9: reapplying after removal (spec §3.3, §4.2, flow 4).
describe('reapplying after removal', () => {
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

  // A vendor the organizer removed, without permission to apply again.
  async function setup() {
    const organizer = await createOrganizer(prisma);
    const eventId = await readyEvent(prisma, organizer.profile.id, { status: 'open_to_vendors' });
    const parts = await eventParts(prisma, eventId);
    const vendor = await createVendor(prisma, [parts.preloved.id]);
    const removed = await submittedApplication(prisma, { eventId, vendorProfileId: vendor.profile.id, categoryId: parts.preloved.id });
    await prisma.application.update({ where: { id: removed.id }, data: { status: 'removed', canReapply: false, removalNote: 'No payment' } });
    return {
      eventId,
      ...parts,
      vendor,
      removed,
      organizerBrowser: await signInAs(app, organizer.user.email),
      vendorBrowser: await signInAs(app, vendor.user.email),
    };
  }

  type Setup = Awaited<ReturnType<typeof setup>>;
  const setReapply = (s: Setup, canReapply: boolean, id = s.removed.id) =>
    s.organizerBrowser.post(`/api/organizer/events/${s.eventId}/applications/${id}/reapply`).send({ canReapply });
  const apply = async (s: Setup) =>
    s.vendorBrowser.post(`/api/vendor/events/${s.event.slug}/applications`).send({
      categoryIds: [s.preloved.id],
      documents: [{ requirementId: s.clearance.id, fileIds: [(await readyFile(prisma, s.vendor.user.id)).id] }],
    });

  it('shows the vendor they are blocked, on the application page and the event page', async () => {
    const s = await setup();

    const page = await s.vendorBrowser.get(`/api/vendor/applications/${s.removed.id}`);
    const event = await s.vendorBrowser.get(`/api/events/${s.event.slug}`);

    expect(page.body).toMatchObject({ status: 'removed', canReapply: false, removalNote: 'No payment' });
    expect(event.body.event.myApplication).toEqual({ id: s.removed.id, status: 'removed', canReapply: false });
    expect((await apply(s)).status).toBe(409);
  });

  it('lets the organizer allow it later; the vendor applies again as a new application and the history stays', async () => {
    const s = await setup();

    const res = await setReapply(s, true);

    expect(res.status).toBe(201);
    expect(res.body.applications.find((a: { id: string }) => a.id === s.removed.id)).toMatchObject({ status: 'removed', canReapply: true });
    expect(await prisma.auditLog.count({ where: { entityId: s.removed.id, action: 'application.reapply_allowed' } })).toBe(1);
    const again = await apply(s);
    expect(again.status).toBe(201);
    expect(again.body.id).not.toBe(s.removed.id);
    const history = await prisma.application.findMany({ where: { eventId: s.eventId, vendorProfileId: s.vendor.profile.id }, orderBy: { submittedAt: 'asc' } });
    expect(history.map((a) => a.status)).toEqual(['removed', 'submitted']);
  });

  it('lets the organizer block it again', async () => {
    const s = await setup();
    await setReapply(s, true);

    await setReapply(s, false);

    expect((await prisma.application.findUniqueOrThrow({ where: { id: s.removed.id } })).canReapply).toBe(false);
    expect(await prisma.auditLog.count({ where: { entityId: s.removed.id, action: 'application.reapply_blocked' } })).toBe(1);
  });

  it('only changes removed applications, and only for the event organizer', async () => {
    const s = await setup();
    const other = await createVendor(prisma, [s.preloved.id]);
    const waiting = await submittedApplication(prisma, { eventId: s.eventId, vendorProfileId: other.profile.id, categoryId: s.preloved.id });
    expect((await setReapply(s, true, waiting.id)).status).toBe(409);

    const stranger = await createOrganizer(prisma);
    const browser = await signInAs(app, stranger.user.email);
    expect((await browser.post(`/api/organizer/events/${s.eventId}/applications/${s.removed.id}/reapply`).send({ canReapply: true })).status).toBe(404);
    expect((await s.vendorBrowser.post(`/api/organizer/events/${s.eventId}/applications/${s.removed.id}/reapply`).send({ canReapply: true })).status).toBe(403);
  });

  it('only looks at the latest removal: a later application unblocks nothing it should not', async () => {
    const s = await setup();
    await setReapply(s, true);
    const second = (await apply(s)).body.id;
    await prisma.application.update({ where: { id: second }, data: { status: 'removed', canReapply: false } });

    expect((await apply(s)).status).toBe(409);
    expect((await s.vendorBrowser.get(`/api/vendor/events/${s.event.slug}/apply`)).body.blocked).toBe('cannot_reapply');
  });
});
