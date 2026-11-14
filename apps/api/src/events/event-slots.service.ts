import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  rowLabels,
  type publicFloorPlanSchema,
  type slotRowSchema,
  type slotSchema,
  type slotSettingsSchema,
} from '@creavent/shared';
import type { z } from 'zod';
import { assertAttachable, retireFiles } from '../files/files.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { assertStillReady } from './event-status.js';
import { OrganizerEventsService, ownEvent } from './organizer-events.service.js';

type SlotFields = z.output<typeof slotSchema>;

// The Slots and Public floor plan tabs (spec §3.4). Slots are a plain list.
// Deleting or renaming an assigned slot is refused once assignments exist
// (Phase 3, data model §6.5).
@Injectable()
export class EventSlotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OrganizerEventsService,
  ) {}

  async add(userId: string, eventId: string, input: SlotFields) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      await assertLabelsFree(tx, event.id, [input.label]);
      await tx.slot.create({ data: { ...input, eventId: event.id, sortOrder: await nextSortOrder(tx, event.id) } });
    });
    return this.events.setup(userId, eventId);
  }

  async addRow(userId: string, eventId: string, input: z.output<typeof slotRowSchema>) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      const labels = rowLabels(input);
      await assertLabelsFree(tx, event.id, labels);
      const start = await nextSortOrder(tx, event.id);
      await tx.slot.createMany({
        data: labels.map((label, i) => ({
          eventId: event.id,
          label,
          section: input.section,
          sizeLabel: input.sizeLabel,
          price: input.price,
          sortOrder: start + i,
        })),
      });
    });
    return this.events.setup(userId, eventId);
  }

  async update(userId: string, eventId: string, slotId: string, input: SlotFields) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      const slot = await ownSlot(tx, event.id, slotId);
      if (slot.label.toLowerCase() !== input.label.toLowerCase()) await assertLabelsFree(tx, event.id, [input.label]);
      await tx.slot.update({ where: { id: slot.id }, data: input });
    });
    return this.events.setup(userId, eventId);
  }

  async remove(userId: string, eventId: string, slotId: string) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      const slot = await ownSlot(tx, event.id, slotId);
      await tx.slot.update({ where: { id: slot.id }, data: { deletedAt: new Date() } });
      await assertStillReady(tx, event.id);
    });
    return this.events.setup(userId, eventId);
  }

  async settings(userId: string, eventId: string, input: z.output<typeof slotSettingsSchema>) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      if (input.vendorFloorPlanFileId && input.vendorFloorPlanFileId !== event.vendorFloorPlanFileId) {
        await assertAttachable(tx, input.vendorFloorPlanFileId, userId, 'vendor_floor_plan');
      }
      await retireFiles(tx, [event.vendorFloorPlanFileId], [input.vendorFloorPlanFileId]);
      await tx.event.update({
        where: { id: event.id },
        data: { slotMode: input.mode, defaultSlotPrice: input.defaultPrice, vendorFloorPlanFileId: input.vendorFloorPlanFileId },
      });
    });
    return this.events.setup(userId, eventId);
  }

  async publicFloorPlan(userId: string, eventId: string, input: z.output<typeof publicFloorPlanSchema>) {
    await this.prisma.$transaction(async (tx) => {
      const event = await ownEvent(tx, userId, eventId);
      if (input.fileId && input.fileId !== event.publicFloorPlanFileId) {
        await assertAttachable(tx, input.fileId, userId, 'public_floor_plan');
      }
      await retireFiles(tx, [event.publicFloorPlanFileId], [input.fileId]);
      await tx.event.update({ where: { id: event.id }, data: { publicFloorPlanFileId: input.fileId } });
    });
    return this.events.setup(userId, eventId);
  }
}

async function ownSlot(tx: Tx, eventId: string, slotId: string) {
  const slot = await tx.slot.findFirst({ where: { id: slotId, eventId, deletedAt: null } });
  if (!slot) throw new NotFoundException('Slot not found');
  return slot;
}

// Labels are unique in the event among slots that aren't removed, ignoring
// case. One taken label stops the whole row.
async function assertLabelsFree(tx: Tx, eventId: string, labels: string[]) {
  const taken = await tx.slot.findFirst({
    where: { eventId, deletedAt: null, OR: labels.map((label) => ({ label: { equals: label, mode: 'insensitive' as const } })) },
  });
  if (taken) throw new ConflictException(`${taken.label} is already in your slot list`);
}

async function nextSortOrder(tx: Tx, eventId: string) {
  const last = await tx.slot.aggregate({ where: { eventId }, _max: { sortOrder: true } });
  return (last._max.sortOrder ?? -1) + 1;
}
