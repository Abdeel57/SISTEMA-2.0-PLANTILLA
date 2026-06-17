-- AlterTable
ALTER TABLE "Raffle" ADD COLUMN "pricingTiers" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "pricingBundles" JSONB NOT NULL DEFAULT '[]';
