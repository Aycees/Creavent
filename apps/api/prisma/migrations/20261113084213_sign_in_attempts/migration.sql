-- CreateTable
CREATE TABLE "sign_in_attempts" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sign_in_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sign_in_attempts_email_created_at_idx" ON "sign_in_attempts"("email", "created_at");

-- CreateIndex
CREATE INDEX "sign_in_attempts_created_at_idx" ON "sign_in_attempts"("created_at");
