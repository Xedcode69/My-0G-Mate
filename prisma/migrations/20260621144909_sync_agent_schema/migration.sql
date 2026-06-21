-- AlterTable
ALTER TABLE "agent_goals" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "agent_profiles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "agent_projects" ALTER COLUMN "updated_at" DROP DEFAULT;
