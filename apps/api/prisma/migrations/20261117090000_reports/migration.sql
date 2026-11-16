-- Reports and the event hidden email (spec §2.2, Phase 5).
-- CreateEnum
CREATE TYPE "report_target" AS ENUM ('user', 'event');

-- CreateEnum
CREATE TYPE "report_source" AS ENUM ('report_button', 'support_email');

-- CreateEnum
CREATE TYPE "report_reason" AS ENUM ('fake_account', 'scam', 'inappropriate_content', 'other');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('open', 'dismissed', 'actioned');

-- CreateEnum
CREATE TYPE "report_action" AS ENUM ('none', 'event_hidden', 'user_suspended', 'other');

-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'event_hidden';

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "source" "report_source" NOT NULL,
    "reporter_user_id" UUID,
    "reporter_email" CITEXT,
    "created_by" UUID,
    "target_type" "report_target" NOT NULL,
    "target_user_id" UUID,
    "target_event_id" UUID,
    "reason" "report_reason" NOT NULL,
    "details" TEXT,
    "status" "report_status" NOT NULL DEFAULT 'open',
    "action_taken" "report_action",
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ,
    "resolution_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reports_number_key" ON "reports"("number");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "reports_target_user_id_idx" ON "reports"("target_user_id");

-- CreateIndex
CREATE INDEX "reports_target_event_id_idx" ON "reports"("target_event_id");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_event_id_fkey" FOREIGN KEY ("target_event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Exactly one target column is set, and it matches target_type (data model §5.8).
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_check" CHECK (
  (target_type = 'user' AND target_user_id IS NOT NULL AND target_event_id IS NULL) OR
  (target_type = 'event' AND target_event_id IS NOT NULL AND target_user_id IS NULL)
);

-- A reporter has at most one open report about the same event or user
-- (decided 2026-11-17).
CREATE UNIQUE INDEX "reports_one_open_per_reporter_user" ON "reports" ("reporter_user_id", "target_user_id")
  WHERE status = 'open' AND reporter_user_id IS NOT NULL AND target_user_id IS NOT NULL;
CREATE UNIQUE INDEX "reports_one_open_per_reporter_event" ON "reports" ("reporter_user_id", "target_event_id")
  WHERE status = 'open' AND reporter_user_id IS NOT NULL AND target_event_id IS NOT NULL;
