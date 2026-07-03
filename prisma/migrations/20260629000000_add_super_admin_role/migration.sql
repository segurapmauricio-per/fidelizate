-- Add SUPER_ADMIN to Role enum (perfil maestro)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- Borrado logico de negocios
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);
