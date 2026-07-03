-- AlterTable: add lastPurchaseAt to Customer (recencia / ancla de timers en GHL)
ALTER TABLE "Customer" ADD COLUMN "lastPurchaseAt" TIMESTAMP(3);
