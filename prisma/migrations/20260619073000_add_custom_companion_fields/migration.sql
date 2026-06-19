-- AlterEnum
ALTER TYPE "CompanionType" ADD VALUE IF NOT EXISTS 'CUSTOM';

-- AlterTable
ALTER TABLE "companions" ADD COLUMN IF NOT EXISTS "custom_type_name" TEXT;
ALTER TABLE "companions" ADD COLUMN IF NOT EXISTS "avatar_image" TEXT;