-- AlterTable
ALTER TABLE "companions" ADD COLUMN IF NOT EXISTS "generated_portrait" TEXT;
ALTER TABLE "companions" ADD COLUMN IF NOT EXISTS "portrait_prompt" TEXT;