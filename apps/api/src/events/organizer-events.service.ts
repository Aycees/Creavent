import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  manilaInstant,
  manilaParts,
  type createEventSchema,
  type eventDetailsSchema,
  type eventPaymentsSchema,
  type eventPolicySchema,
  paymentChannelLabels,
  type eventRequirementsSchema,
  type EventSetup,
} from '@creavent/shared';
import type { z } from 'zod';
import { appConfig } from '../config.js';
import { assertAttachable, FilesService, retireFiles } from '../files/files.service.js';
import { freeSlug } from '../onboarding/slugs.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';

type Db = Tx | PrismaService;

// Event setup for the event's organizer (spec §3.1, sitemap §4). Every save
// answers with the whole setup state, like the profile pages.
@Injectable()
export class OrganizerEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  eventTypes() {
    return this.prisma.eventType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, slug: true },
    });
  }

  async create(userId: string, input: z.output<typeof createEventSchema>) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await organizerProfile(tx, userId);
      await assertEventType(tx, input.eventTypeId);
      // Most organizers write their policy once (spec §3.7).
      const last = await tx.event.findFirst({
        where: { organizerProfileId: profile.id, policyText: { not: null } },
        orderBy: { createdAt: 'desc' },
      });
      const event = await tx.event.create({
        data: {
          organizerProfileId: profile.id,
          eventTypeId: input.eventTypeId,
          name: input.name,
          slug: await freeSlug(tx, 'event', input.name, userId),
          policyText: last?.policyText ?? null,
          policySourceEventId: last?.id ?? null,
          paymentDeadlineHours: appConfig().defaultPaymentDeadlineHours,
        },
      });
      return { id: event.id };
    });
  }

  async setup(userId: string, eventId: string): Promise<EventSetup> {
    await organizerProfile(this.prisma, userId);
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organizerProfile: { userId } },
      include: {
        coverFile: true,
        policySource: { select: { id: true, name: true, policyText: true } },
        categories: { include: { category: true } },
        documents: { orderBy: { sortOrder: 'asc' } },
        paymentMethods: { where: { isActive: true }, orderBy: { sortOrder: 'asc' }, include: { qrFile: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    const start = event.startsAt ? manilaParts(event.startsAt) : null;
    const end = event.endsAt ? manilaParts(event.endsAt) : null;
    const close = event.applicationsCloseAt ? manilaParts(event.applicationsCloseAt) : null;
    return {
      id: event.id,
      slug: event.slug,
      status: event.status,
      applicationsOpen: event.applicationsOpen,
      details: {
        name: event.name,
        eventTypeId: event.eventTypeId,
        description: event.description,
        startDate: start?.date ?? null,
        endDate: end?.date ?? null,
        opensAt: start?.time ?? null,
        closesAt: end?.time ?? null,
        venueName: event.venueName,
        addressLine: event.addressLine,
        city: event.city,
        cover: event.coverFile ? { id: event.coverFile.id, url: this.files.url(event.coverFile.storageKey) } : null,
        vendorContactInfo: event.vendorContactInfo,
        applicationsCloseAt: close ? `${close.date}T${close.time}` : null,
        ingressInfo: event.ingressInfo,
      },
      eventTypes: await this.eventTypes(),
      categories: await this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
      }),
      requirements: {
        categories: event.categories
          .sort((a, b) => a.category.sortOrder - b.category.sortOrder)
          .map((c) => ({ categoryId: c.categoryId, maxVendors: c.maxVendors })),
        documents: event.documents.map((d) => ({ id: d.id, name: d.name, description: d.description, categoryId: d.categoryId })),
      },
      policy: {
        text: event.policyText,
        // Only while the text is still the copied one.
        copiedFrom:
          event.policySource && event.policySource.policyText === event.policyText
            ? { id: event.policySource.id, name: event.policySource.name }
            : null,
        example: appConfig().examplePolicyText,
      },
      payments: {
        deadlineHours: event.paymentDeadlineHours,
        methods: event.paymentMethods.map((m) => ({
          id: m.id,
          channel: m.channel,
          label: m.label,
          accountName: m.accountName,
          accountNumber: m.accountNumber,
          qr: m.qrFile ? { id: m.qrFile.id, url: this.files.fileUrl(m.qrFile) } : null,
          notes: m.notes,
        })),
      },
    };
  }

  async updatePayments(userId: string, eventId: string, input: z.output<typeof eventPaymentsSchema>) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      const existing = await tx.eventPaymentMethod.findMany({ where: { eventId: event.id } });
      const byId = new Map(existing.map((m) => [m.id, m]));
      if (input.methods.some((m) => m.id && !byId.has(m.id))) throw new BadRequestException('This payment option is not on this event');
      for (const m of input.methods) {
        if (m.qrFileId && m.qrFileId !== byId.get(m.id ?? '')?.qrFileId) await assertAttachable(tx, m.qrFileId, userId, 'payment_qr');
      }
      await tx.event.update({ where: { id: event.id }, data: { paymentDeadlineHours: input.deadlineHours } });
      // Removed options are turned off, not deleted (data model §5.4).
      const keep = input.methods.flatMap((m) => m.id ?? []);
      await tx.eventPaymentMethod.updateMany({ where: { eventId: event.id, id: { notIn: keep } }, data: { isActive: false } });
      for (const [sortOrder, m] of input.methods.entries()) {
        const data = {
          channel: m.channel,
          label: `${paymentChannelLabels[m.channel]}, ${m.accountName}`,
          accountName: m.accountName,
          accountNumber: m.accountNumber,
          qrFileId: m.qrFileId,
          notes: m.notes,
          sortOrder,
          isActive: true,
        };
        if (m.id) await tx.eventPaymentMethod.update({ where: { id: m.id }, data });
        else await tx.eventPaymentMethod.create({ data: { ...data, eventId: event.id } });
      }
    });
    return this.setup(userId, eventId);
  }

  async updateRequirements(userId: string, eventId: string, input: z.output<typeof eventRequirementsSchema>) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      const ids = input.categories.map((c) => c.categoryId);
      const active = await tx.category.count({ where: { id: { in: ids }, isActive: true } });
      if (active !== ids.length) throw new BadRequestException('Pick categories from the list');
      if (input.documents.some((d) => d.categoryId && !ids.includes(d.categoryId))) {
        throw new BadRequestException('Accept this category to ask for its document');
      }
      const existing = await tx.eventDocumentRequirement.findMany({ where: { eventId: event.id }, select: { id: true } });
      const existingIds = new Set(existing.map((d) => d.id));
      if (input.documents.some((d) => d.id && !existingIds.has(d.id))) throw new BadRequestException('This document is not on this event');

      await tx.eventCategory.deleteMany({ where: { eventId: event.id } });
      await tx.eventCategory.createMany({ data: input.categories.map((c) => ({ eventId: event.id, ...c })) });
      const keep = input.documents.flatMap((d) => d.id ?? []);
      await tx.eventDocumentRequirement.deleteMany({ where: { eventId: event.id, id: { notIn: keep } } });
      for (const [sortOrder, d] of input.documents.entries()) {
        const data = { name: d.name, description: d.description, categoryId: d.categoryId, sortOrder };
        if (d.id) await tx.eventDocumentRequirement.update({ where: { id: d.id }, data });
        else await tx.eventDocumentRequirement.create({ data: { ...data, eventId: event.id } });
      }
    });
    return this.setup(userId, eventId);
  }

  async updatePolicy(userId: string, eventId: string, input: z.output<typeof eventPolicySchema>) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      await tx.event.update({ where: { id: event.id }, data: { policyText: input.text } });
    });
    return this.setup(userId, eventId);
  }

  async updateDetails(userId: string, eventId: string, input: z.output<typeof eventDetailsSchema>) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      if (input.eventTypeId !== event.eventTypeId) await assertEventType(tx, input.eventTypeId);
      if (input.coverFileId) await assertAttachable(tx, input.coverFileId, userId, 'event_cover');
      await retireFiles(tx, [event.coverFileId], [input.coverFileId]);
      const scheduled = input.startDate && input.endDate && input.opensAt && input.closesAt;
      const [closeDate, closeTime] = input.applicationsCloseAt?.split('T') ?? [];
      await tx.event.update({
        where: { id: event.id },
        data: {
          name: input.name,
          eventTypeId: input.eventTypeId,
          description: input.description,
          startsAt: scheduled ? manilaInstant(input.startDate!, input.opensAt!) : null,
          endsAt: scheduled ? manilaInstant(input.endDate!, input.closesAt!) : null,
          venueName: input.venueName,
          addressLine: input.addressLine,
          city: input.city,
          coverFileId: input.coverFileId,
          vendorContactInfo: input.vendorContactInfo,
          applicationsCloseAt: closeDate ? manilaInstant(closeDate, closeTime!) : null,
          ingressInfo: input.ingressInfo,
        },
      });
    });
    return this.setup(userId, eventId);
  }
}

// The organizer profile of a user who may run events: the organizer role,
// not suspended, with the organizer page and a mobile number (flow 1).
// Approval is not needed for drafts (spec §10).
export async function organizerProfile(db: Db, userId: string) {
  const role = await db.userRole.findUnique({ where: { userId_role: { userId, role: 'organizer' } } });
  if (!role) throw new ForbiddenException('Add the organizer role first');
  if (role.suspendedAt) throw new ForbiddenException('Your organizer role is suspended');
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { organizerProfile: true } });
  if (!user.organizerProfile || !user.phone) {
    throw new ForbiddenException('Finish your organizer page and contact number first');
  }
  return user.organizerProfile;
}

// The organizer's own event, or Not found for anyone else.
export async function ownEvent(tx: Tx, userId: string, eventId: string) {
  await organizerProfile(tx, userId);
  const event = await tx.event.findFirst({ where: { id: eventId, organizerProfile: { userId } } });
  if (!event) throw new NotFoundException('Event not found');
  return event;
}

async function assertEventType(tx: Tx, eventTypeId: string) {
  const type = await tx.eventType.findFirst({ where: { id: eventTypeId, isActive: true } });
  if (!type) throw new BadRequestException('Pick an event type from the list');
}
