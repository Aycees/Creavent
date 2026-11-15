-- CreateEnum
CREATE TYPE "assignment_status" AS ENUM ('assigned', 'reserved', 'released', 'removed', 'canceled');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'submitted', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('proof_upload', 'cash', 'other');

-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'slot_assigned';

-- CreateTable
CREATE TABLE "slot_assignments" (
    "id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "vendor_profile_id" UUID NOT NULL,
    "status" "assignment_status" NOT NULL DEFAULT 'assigned',
    "price_locked" DECIMAL(10,2) NOT NULL,
    "payment_instructions_snapshot" JSONB,
    "assigned_at" TIMESTAMPTZ NOT NULL,
    "assigned_by" UUID NOT NULL,
    "deadline_at" TIMESTAMPTZ NOT NULL,
    "reserved_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "ended_by" UUID,
    "ended_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "slot_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "slot_assignment_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "payer_user_id" UUID NOT NULL,
    "payee_user_id" UUID NOT NULL,
    "amount_due" DECIMAL(10,2) NOT NULL,
    "amount_paid" DECIMAL(10,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'PHP',
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "method" "payment_method" NOT NULL DEFAULT 'proof_upload',
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ,
    "decision_note" TEXT,
    "archived_at" TIMESTAMPTZ,
    "platform_fee_amount" DECIMAL(10,2),
    "platform_fee_payer" TEXT,
    "processing_fee_amount" DECIMAL(10,2),
    "net_payout_amount" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slot_assignments_event_id_status_idx" ON "slot_assignments"("event_id", "status");

-- CreateIndex
CREATE INDEX "slot_assignments_application_id_idx" ON "slot_assignments"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_slot_assignment_id_key" ON "payments"("slot_assignment_id");

-- CreateIndex
CREATE INDEX "payments_event_id_status_idx" ON "payments"("event_id", "status");

-- AddForeignKey
ALTER TABLE "slot_assignments" ADD CONSTRAINT "slot_assignments_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_assignments" ADD CONSTRAINT "slot_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_assignments" ADD CONSTRAINT "slot_assignments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_assignments" ADD CONSTRAINT "slot_assignments_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_assignments" ADD CONSTRAINT "slot_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_assignments" ADD CONSTRAINT "slot_assignments_ended_by_fkey" FOREIGN KEY ("ended_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_slot_assignment_id_fkey" FOREIGN KEY ("slot_assignment_id") REFERENCES "slot_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_user_id_fkey" FOREIGN KEY ("payer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payee_user_id_fkey" FOREIGN KEY ("payee_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A slot belongs to one vendor at a time, and a vendor has one slot per
-- event (data model §6.3, §6.4).
CREATE UNIQUE INDEX "slot_assignments_one_active_per_slot_key" ON "slot_assignments" ("slot_id") WHERE "status" IN ('assigned', 'reserved');
CREATE UNIQUE INDEX "slot_assignments_one_active_per_vendor_key" ON "slot_assignments" ("event_id", "vendor_profile_id") WHERE "status" IN ('assigned', 'reserved');

-- Money is never negative (data model §6.9).
ALTER TABLE "slot_assignments" ADD CONSTRAINT "slot_assignments_price_locked_check" CHECK ("price_locked" >= 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_due_check" CHECK ("amount_due" >= 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_paid_check" CHECK ("amount_paid" IS NULL OR "amount_paid" >= 0);
