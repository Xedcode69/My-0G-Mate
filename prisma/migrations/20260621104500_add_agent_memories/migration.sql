CREATE TYPE "AgentMemoryCategory" AS ENUM ('PREFERENCE', 'GOAL', 'FEEDBACK', 'FACT', 'DECISION', 'PROJECT');

CREATE TABLE "agent_memories" (
    "id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "category" "AgentMemoryCategory" NOT NULL,
    "content" TEXT NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 5,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_memories_companion_id_category_importance_idx"
ON "agent_memories"("companion_id", "category", "importance");

ALTER TABLE "agent_memories"
ADD CONSTRAINT "agent_memories_companion_id_fkey"
FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
