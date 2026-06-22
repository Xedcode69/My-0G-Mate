ALTER TABLE "agent_profiles"
ADD COLUMN "validation_status" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "validation_notes" TEXT,
ADD COLUMN "validated_at" TIMESTAMP(3),
ADD COLUMN "profile_version" INTEGER NOT NULL DEFAULT 1;
