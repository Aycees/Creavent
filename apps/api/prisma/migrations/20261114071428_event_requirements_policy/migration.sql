-- AlterTable
ALTER TABLE "events" ADD COLUMN     "policy_source_event_id" UUID,
ADD COLUMN     "policy_text" TEXT;

-- CreateTable
CREATE TABLE "event_categories" (
    "event_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "max_vendors" INTEGER,

    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("event_id","category_id")
);

-- CreateTable
CREATE TABLE "event_document_requirements" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category_id" UUID,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "event_document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_document_requirements_event_id_idx" ON "event_document_requirements"("event_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_policy_source_event_id_fkey" FOREIGN KEY ("policy_source_event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_document_requirements" ADD CONSTRAINT "event_document_requirements_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_document_requirements" ADD CONSTRAINT "event_document_requirements_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A limit on similar vendors is at least 1 when set.
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_max_vendors_check" CHECK ("max_vendors" IS NULL OR "max_vendors" >= 1);
