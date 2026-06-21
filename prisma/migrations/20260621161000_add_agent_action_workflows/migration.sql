CREATE TYPE "AgentActionRunStatus" AS ENUM ('ACTIVE', 'COMPLETE', 'CANCELLED');

CREATE TABLE "agent_action_definitions" (
    "id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "starter_question" TEXT NOT NULL,
    "workflow_instructions" TEXT NOT NULL,
    "required_information" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "completion_criteria" TEXT NOT NULL,
    "safety_constraints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'TEMPLATE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_action_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_action_runs" (
    "id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "status" "AgentActionRunStatus" NOT NULL DEFAULT 'ACTIVE',
    "collected_data" JSONB,
    "result" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "agent_action_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_action_definitions_companion_id_key_key"
ON "agent_action_definitions"("companion_id", "key");

CREATE INDEX "agent_action_definitions_companion_id_enabled_sort_order_idx"
ON "agent_action_definitions"("companion_id", "enabled", "sort_order");

CREATE INDEX "agent_action_runs_companion_id_status_started_at_idx"
ON "agent_action_runs"("companion_id", "status", "started_at");

CREATE INDEX "agent_action_runs_action_id_status_idx"
ON "agent_action_runs"("action_id", "status");

ALTER TABLE "agent_action_definitions"
ADD CONSTRAINT "agent_action_definitions_companion_id_fkey"
FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_action_runs"
ADD CONSTRAINT "agent_action_runs_companion_id_fkey"
FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_action_runs"
ADD CONSTRAINT "agent_action_runs_action_id_fkey"
FOREIGN KEY ("action_id") REFERENCES "agent_action_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
