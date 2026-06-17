-- AlterTable
ALTER TABLE "Raffle" ADD COLUMN "promoEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "promoTitle" TEXT,
ADD COLUMN "promoSubtitle" TEXT,
ADD COLUMN "promoColorFrom" TEXT,
ADD COLUMN "promoColorTo" TEXT;
