-- CreateEnum
CREATE TYPE "slot_mode" AS ENUM ('organizer_assigns', 'vendor_preference');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "default_slot_price" DECIMAL(10,2),
ADD COLUMN     "public_floor_plan_file_id" UUID,
ADD COLUMN     "slot_mode" "slot_mode" NOT NULL DEFAULT 'organizer_assigns',
ADD COLUMN     "vendor_floor_plan_file_id" UUID;

-- CreateTable
CREATE TABLE "slots" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "section" TEXT,
    "price" DECIMAL(10,2),
    "size_label" TEXT,
    "note" TEXT,
    "sort_order" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slots_event_id_idx" ON "slots"("event_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_vendor_floor_plan_file_id_fkey" FOREIGN KEY ("vendor_floor_plan_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_public_floor_plan_file_id_fkey" FOREIGN KEY ("public_floor_plan_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A slot label is unique in its event among slots that aren't removed,
-- ignoring case (data model §5.5).
CREATE UNIQUE INDEX "slots_event_label_key" ON "slots" ("event_id", lower("label")) WHERE "deleted_at" IS NULL;

-- Money is never negative (data model §6.9).
ALTER TABLE "slots" ADD CONSTRAINT "slots_price_check" CHECK ("price" IS NULL OR "price" >= 0);
ALTER TABLE "events" ADD CONSTRAINT "events_default_slot_price_check" CHECK ("default_slot_price" IS NULL OR "default_slot_price" >= 0);
