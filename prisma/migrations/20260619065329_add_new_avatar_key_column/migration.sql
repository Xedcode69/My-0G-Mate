-- CreateEnum
CREATE TYPE "CompanionType" AS ENUM ('ROBOT', 'PET', 'ANIME_GIRL', 'SPIRIT');

-- CreateEnum
CREATE TYPE "CompanionMood" AS ENUM ('HAPPY', 'NEUTRAL', 'LONELY', 'EXCITED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('DAILY_CHECK_IN', 'FEED_COMPANION', 'PLAY_MINI_GAME', 'REFLECTION_PROMPT', 'ASK_COMPANION_QUESTION');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "username" TEXT,
    "nonce" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "blockchain_id" TEXT,
    "name" TEXT NOT NULL,
    "type" "CompanionType" NOT NULL,
    "avatar_key" TEXT NOT NULL DEFAULT 'default',
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "mood" "CompanionMood" NOT NULL DEFAULT 'NEUTRAL',
    "relationship_level" INTEGER NOT NULL DEFAULT 1,
    "trust_score" INTEGER NOT NULL DEFAULT 5,
    "attachment_score" INTEGER NOT NULL DEFAULT 5,
    "evolution_stage" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "memory_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "importance" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personality_profiles" (
    "id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "humor_score" INTEGER NOT NULL DEFAULT 50,
    "supportiveness_score" INTEGER NOT NULL DEFAULT 50,
    "curiosity_score" INTEGER NOT NULL DEFAULT 50,
    "emotional_score" INTEGER NOT NULL DEFAULT 50,
    "concise_score" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "personality_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "activity_type" "ActivityType" NOT NULL,
    "xp_earned" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_logs" (
    "id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "user_message" TEXT NOT NULL,
    "companion_response" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_snapshots" (
    "id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "root_hash" TEXT NOT NULL,
    "snapshot_version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "companions_blockchain_id_key" ON "companions"("blockchain_id");

-- CreateIndex
CREATE INDEX "companions_user_id_idx" ON "companions"("user_id");

-- CreateIndex
CREATE INDEX "memories_companion_id_importance_idx" ON "memories"("companion_id", "importance");

-- CreateIndex
CREATE UNIQUE INDEX "personality_profiles_companion_id_key" ON "personality_profiles"("companion_id");

-- CreateIndex
CREATE INDEX "activity_logs_companion_id_activity_type_created_at_idx" ON "activity_logs"("companion_id", "activity_type", "created_at");

-- CreateIndex
CREATE INDEX "chat_logs_companion_id_created_at_idx" ON "chat_logs"("companion_id", "created_at");

-- CreateIndex
CREATE INDEX "memory_snapshots_companion_id_snapshot_version_idx" ON "memory_snapshots"("companion_id", "snapshot_version");

-- AddForeignKey
ALTER TABLE "companions" ADD CONSTRAINT "companions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personality_profiles" ADD CONSTRAINT "personality_profiles_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_logs" ADD CONSTRAINT "chat_logs_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_snapshots" ADD CONSTRAINT "memory_snapshots_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
