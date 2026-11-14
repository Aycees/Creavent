-- CreateEnum
CREATE TYPE "payment_channel" AS ENUM ('gcash', 'maya', 'bank', 'other');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "payment_deadline_hours" INTEGER NOT NULL DEFAULT 24;

-- CreateTable
CREATE TABLE "event_payment_methods" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "channel" "payment_channel" NOT NULL,
    "label" TEXT NOT NULL,
    "account_name" TEXT,
    "account_number" TEXT,
    "qr_file_id" UUID,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "event_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_payment_methods_event_id_idx" ON "event_payment_methods"("event_id");

-- AddForeignKey
ALTER TABLE "event_payment_methods" ADD CONSTRAINT "event_payment_methods_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_payment_methods" ADD CONSTRAINT "event_payment_methods_qr_file_id_fkey" FOREIGN KEY ("qr_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Vendors pay within 1 hour to 7 days of getting a slot.
ALTER TABLE "events" ADD CONSTRAINT "events_payment_deadline_hours_check" CHECK ("payment_deadline_hours" BETWEEN 1 AND 168);
