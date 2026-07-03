-- Canje de premio: estado y contadores en Customer + webhook de canje en Business
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "rewardPending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "rewardsEarned" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "rewardsRedeemed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lastRedeemedAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "ghlRedeemWebhookUrl" TEXT;
