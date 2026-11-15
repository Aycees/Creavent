-- CreateEnum
CREATE TYPE "application_status" AS ENUM ('submitted', 'approved', 'declined', 'removed', 'withdrawn');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_type" ADD VALUE 'application_submitted';
ALTER TYPE "notification_type" ADD VALUE 'application_withdrawn';

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "vendor_profile_id" UUID NOT NULL,
    "status" "application_status" NOT NULL DEFAULT 'submitted',
    "vendor_note" TEXT,
    "preferred_slot_id" UUID,
    "policy_text_snapshot" TEXT NOT NULL,
    "policy_accepted_at" TIMESTAMPTZ NOT NULL,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ,
    "decision_note" TEXT,
    "withdrawn_at" TIMESTAMPTZ,
    "removed_at" TIMESTAMPTZ,
    "removed_by" UUID,
    "removal_note" TEXT,
    "can_reapply" BOOLEAN,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_categories" (
    "application_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "application_categories_pkey" PRIMARY KEY ("application_id","category_id")
);

-- CreateTable
CREATE TABLE "application_documents" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "requirement_id" UUID,
    "file_id" UUID NOT NULL,

    CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applications_event_id_status_idx" ON "applications"("event_id", "status");

-- CreateIndex
CREATE INDEX "applications_vendor_profile_id_idx" ON "applications"("vendor_profile_id");

-- CreateIndex
CREATE INDEX "application_documents_application_id_idx" ON "application_documents"("application_id");

-- CreateIndex
CREATE INDEX "application_documents_file_id_idx" ON "application_documents"("file_id");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_preferred_slot_id_fkey" FOREIGN KEY ("preferred_slot_id") REFERENCES "slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_removed_by_fkey" FOREIGN KEY ("removed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_categories" ADD CONSTRAINT "application_categories_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_categories" ADD CONSTRAINT "application_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "event_document_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One active application per vendor per event (data model §6.2).
CREATE UNIQUE INDEX "applications_one_active_key" ON "applications" ("event_id", "vendor_profile_id") WHERE "status" IN ('submitted', 'approved');
