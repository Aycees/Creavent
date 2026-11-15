-- Set-aside slots and several slots per vendor (decisions P1 to P6).

-- AlterTable
ALTER TABLE "events" ADD COLUMN "max_slots_per_vendor" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "events" ADD CONSTRAINT "events_max_slots_per_vendor_check" CHECK ("max_slots_per_vendor" BETWEEN 1 AND 10);

-- AlterTable
ALTER TABLE "slots" ADD COLUMN "set_aside_at" TIMESTAMPTZ,
ADD COLUMN "set_aside_note" TEXT;

-- AlterTable
ALTER TABLE "applications" ADD COLUMN "slots_requested" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "applications" ADD CONSTRAINT "applications_slots_requested_check" CHECK ("slots_requested" BETWEEN 1 AND 10);

-- CreateTable
CREATE TABLE "application_preferred_slots" (
    "application_id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,

    CONSTRAINT "application_preferred_slots_pkey" PRIMARY KEY ("application_id","slot_id")
);

-- CreateIndex
CREATE INDEX "application_preferred_slots_slot_id_idx" ON "application_preferred_slots"("slot_id");

-- AddForeignKey
ALTER TABLE "application_preferred_slots" ADD CONSTRAINT "application_preferred_slots_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_preferred_slots" ADD CONSTRAINT "application_preferred_slots_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep the preferences already sent.
INSERT INTO "application_preferred_slots" ("application_id", "slot_id")
SELECT "id", "preferred_slot_id" FROM "applications" WHERE "preferred_slot_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_preferred_slot_id_fkey";

-- AlterTable
ALTER TABLE "applications" DROP COLUMN "preferred_slot_id";

-- CreateTable
CREATE TABLE "slot_assignment_slots" (
    "slot_assignment_id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "price_locked" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "slot_assignment_slots_pkey" PRIMARY KEY ("slot_assignment_id","slot_id")
);

-- CreateIndex
CREATE INDEX "slot_assignment_slots_slot_id_idx" ON "slot_assignment_slots"("slot_id");

-- AddForeignKey
ALTER TABLE "slot_assignment_slots" ADD CONSTRAINT "slot_assignment_slots_slot_assignment_id_fkey" FOREIGN KEY ("slot_assignment_id") REFERENCES "slot_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "slot_assignment_slots" ADD CONSTRAINT "slot_assignment_slots_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "slot_assignment_slots" ADD CONSTRAINT "slot_assignment_slots_price_locked_check" CHECK ("price_locked" >= 0);

-- Every existing assignment covers its one slot.
INSERT INTO "slot_assignment_slots" ("slot_assignment_id", "slot_id", "price_locked", "active")
SELECT "id", "slot_id", "price_locked", "status" IN ('assigned', 'reserved') FROM "slot_assignments";

-- Each slot is in at most one active assignment (data model §6.3). Replaces
-- the index on slot_assignments.slot_id.
CREATE UNIQUE INDEX "slot_assignment_slots_one_active_per_slot_key" ON "slot_assignment_slots" ("slot_id") WHERE "active";
DROP INDEX "slot_assignments_one_active_per_slot_key";

-- DropForeignKey
ALTER TABLE "slot_assignments" DROP CONSTRAINT "slot_assignments_slot_id_fkey";

-- AlterTable
ALTER TABLE "slot_assignments" DROP COLUMN "slot_id";
