CREATE TYPE "ArchiveJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');

CREATE TABLE "companion_archive_jobs" (
    "id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ArchiveJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "root_hash" TEXT,
    "last_error" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "companion_archive_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "companion_archive_jobs_status_requested_at_idx"
ON "companion_archive_jobs"("status", "requested_at");

CREATE INDEX "companion_archive_jobs_companion_id_status_idx"
ON "companion_archive_jobs"("companion_id", "status");

ALTER TABLE "companion_archive_jobs"
ADD CONSTRAINT "companion_archive_jobs_companion_id_fkey"
FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
