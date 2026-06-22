CREATE TABLE "agent_profiles" (
    "id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "mission" TEXT NOT NULL,
    "scope" TEXT[] NOT NULL,
    "boundaries" TEXT[] NOT NULL,
    "expertise" TEXT[] NOT NULL,
    "success_criteria" TEXT[] NOT NULL,
    "response_style" TEXT,
    "autonomy_level" TEXT NOT NULL DEFAULT 'ADVISOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_profiles_companion_id_key" ON "agent_profiles"("companion_id");

ALTER TABLE "agent_profiles"
ADD CONSTRAINT "agent_profiles_companion_id_fkey"
FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
