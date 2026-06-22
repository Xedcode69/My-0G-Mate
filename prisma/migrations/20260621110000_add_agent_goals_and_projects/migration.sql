CREATE TYPE "AgentGoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETE');

CREATE TABLE "agent_projects" (
    "id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "AgentGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "next_step" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_goals" (
    "id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "project_id" TEXT,
    "title" TEXT NOT NULL,
    "status" "AgentGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "next_step" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_goals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_projects_companion_id_status_priority_idx"
ON "agent_projects"("companion_id", "status", "priority");

CREATE INDEX "agent_goals_companion_id_status_priority_idx"
ON "agent_goals"("companion_id", "status", "priority");

CREATE INDEX "agent_goals_project_id_idx" ON "agent_goals"("project_id");

ALTER TABLE "agent_projects"
ADD CONSTRAINT "agent_projects_companion_id_fkey"
FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_goals"
ADD CONSTRAINT "agent_goals_companion_id_fkey"
FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_goals"
ADD CONSTRAINT "agent_goals_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "agent_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
