-- Pop-up events (spec §4.7, Phase 6): vendor-hosted events, pop-up host
-- approval, and the moderation that goes with them.

-- CreateEnum
CREATE TYPE "approval_source" AS ENUM ('reviewed', 'earned');

-- CreateEnum
CREATE TYPE "event_host_kind" AS ENUM ('organizer', 'vendor');

-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'host_approved';
ALTER TYPE "notification_type" ADD VALUE 'host_rejected';
ALTER TYPE "notification_type" ADD VALUE 'host_approval_revoked';

-- AlterEnum
ALTER TYPE "report_reason" ADD VALUE 'fake_or_misleading_event' BEFORE 'scam';

-- AlterEnum
ALTER TYPE "report_action" ADD VALUE 'host_approval_revoked' BEFORE 'other';

-- Each type says who hosts it: Pop-up is for vendors (decided 2026-11-17).
ALTER TABLE "event_types" ADD COLUMN "host_kind" "event_host_kind" NOT NULL DEFAULT 'organizer';
UPDATE "event_types" SET "host_kind" = 'vendor', "updated_at" = now() WHERE "slug" = 'pop-up';

-- Pop-up host approval lives on the vendor row (data model §5.1).
ALTER TABLE "user_roles" ADD COLUMN "approval_source" "approval_source",
ADD COLUMN "host_revoked_at" TIMESTAMPTZ;
UPDATE "user_roles" SET "approval_status" = 'not_submitted' WHERE "role" = 'vendor' AND "approval_status" IS NULL;

-- A pop-up is hosted by a vendor instead of an organizer.
ALTER TABLE "events" ALTER COLUMN "organizer_profile_id" DROP NOT NULL,
ADD COLUMN "host_vendor_profile_id" UUID;

ALTER TABLE "events" ADD CONSTRAINT "events_host_vendor_profile_id_fkey" FOREIGN KEY ("host_vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Organizer events that used Pop-up before it became a vendor type move to
-- Bazaar (U20).
UPDATE "events" SET "event_type_id" = (SELECT "id" FROM "event_types" WHERE "slug" = 'bazaar'), "updated_at" = now()
WHERE "organizer_profile_id" IS NOT NULL AND "event_type_id" = (SELECT "id" FROM "event_types" WHERE "slug" = 'pop-up');

-- Rule 6.14: exactly one host, and a pop-up is never open to vendors.
ALTER TABLE "events" ADD CONSTRAINT "events_one_host" CHECK (num_nonnulls("organizer_profile_id", "host_vendor_profile_id") = 1);
ALTER TABLE "events" ADD CONSTRAINT "events_popup_not_open" CHECK ("host_vendor_profile_id" IS NULL OR ("status" <> 'open_to_vendors' AND "applications_open" = false));

-- A host's pop-ups, and the vendor page (data model §6).
CREATE INDEX "events_host_vendor_profile_id_starts_at_idx" ON "events"("host_vendor_profile_id", "starts_at") WHERE "host_vendor_profile_id" IS NOT NULL;
