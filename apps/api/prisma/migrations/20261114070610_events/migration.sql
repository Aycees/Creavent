-- CreateEnum
CREATE TYPE "event_status" AS ENUM ('draft', 'open_to_vendors', 'announced', 'completed', 'canceled');

-- CreateEnum
CREATE TYPE "moderation_state" AS ENUM ('visible', 'hidden');

-- CreateTable
CREATE TABLE "event_types" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "event_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "organizer_profile_id" UUID NOT NULL,
    "event_type_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "cover_file_id" UUID,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "venue_name" TEXT,
    "address_line" TEXT,
    "city" TEXT,
    "province" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "vendor_contact_info" TEXT,
    "status" "event_status" NOT NULL DEFAULT 'draft',
    "moderation_state" "moderation_state" NOT NULL DEFAULT 'visible',
    "moderated_at" TIMESTAMPTZ,
    "moderated_by" UUID,
    "moderation_reason" TEXT,
    "applications_open" BOOLEAN NOT NULL DEFAULT false,
    "applications_close_at" TIMESTAMPTZ,
    "ingress_info" TEXT,
    "currency" CHAR(3) NOT NULL DEFAULT 'PHP',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "opened_to_vendors_at" TIMESTAMPTZ,
    "announced_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "canceled_at" TIMESTAMPTZ,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_types_name_key" ON "event_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "event_types_slug_key" ON "event_types"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_organizer_profile_id_idx" ON "events"("organizer_profile_id");

-- CreateIndex
CREATE INDEX "events_status_moderation_state_starts_at_idx" ON "events"("status", "moderation_state", "starts_at");

-- CreateIndex
CREATE INDEX "events_city_starts_at_idx" ON "events"("city", "starts_at");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_profile_id_fkey" FOREIGN KEY ("organizer_profile_id") REFERENCES "organizer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_cover_file_id_fkey" FOREIGN KEY ("cover_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_moderated_by_fkey" FOREIGN KEY ("moderated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rules the database keeps (data model §6.12, §6.13), in the event's time zone.
-- An event runs 1 to 7 days in a row and closes later than it opens each day.
ALTER TABLE "events" ADD CONSTRAINT "events_schedule_check" CHECK (
  ("starts_at" IS NULL AND "ends_at" IS NULL)
  OR (
    "starts_at" IS NOT NULL AND "ends_at" IS NOT NULL
    AND ("ends_at" AT TIME ZONE "timezone")::date - ("starts_at" AT TIME ZONE "timezone")::date BETWEEN 0 AND 6
    AND ("ends_at" AT TIME ZONE "timezone")::time > ("starts_at" AT TIME ZONE "timezone")::time
  )
);

-- The applications close date is not after the event start.
ALTER TABLE "events" ADD CONSTRAINT "events_applications_close_check" CHECK (
  "applications_close_at" IS NULL OR "starts_at" IS NULL OR "applications_close_at" <= "starts_at"
);

-- The platform-wide event types (spec §3.1, data model §5.4). Reference data
-- every environment needs, so they ship as a migration, like categories.
INSERT INTO "event_types" ("id", "name", "slug", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'Flea market', 'flea-market', 1, now()),
  (gen_random_uuid(), 'Bazaar', 'bazaar', 2, now()),
  (gen_random_uuid(), 'Pop-up', 'pop-up', 3, now());
