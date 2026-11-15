-- CreateEnum
CREATE TYPE "proof_status" AS ENUM ('submitted', 'approved', 'rejected');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_type" ADD VALUE 'proof_uploaded';
ALTER TYPE "notification_type" ADD VALUE 'payment_approved';
ALTER TYPE "notification_type" ADD VALUE 'payment_rejected';

-- CreateTable
CREATE TABLE "payment_proofs" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "vendor_profile_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "payment_method_id" UUID NOT NULL,
    "amount_claimed" DECIMAL(10,2),
    "reference_number" TEXT,
    "note" TEXT,
    "status" "proof_status" NOT NULL DEFAULT 'submitted',
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ,
    "rejection_reason" TEXT,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payment_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_proofs_payment_id_idx" ON "payment_proofs"("payment_id");

-- CreateIndex
CREATE INDEX "payment_proofs_event_id_status_idx" ON "payment_proofs"("event_id", "status");

-- CreateIndex
CREATE INDEX "payment_proofs_file_id_idx" ON "payment_proofs"("file_id");

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "event_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Money is never negative (data model §6.9).
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_amount_claimed_check" CHECK ("amount_claimed" IS NULL OR "amount_claimed" >= 0);
