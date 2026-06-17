-- Oportunidades por boleto (boletos de regalo).
-- Aditivo y compatible: rifas y boletos existentes quedan con opportunities=1 e isGift=false.

-- Rifa: cuántas oportunidades (números participantes) genera cada boleto manual.
ALTER TABLE "Raffle" ADD COLUMN "opportunities" INTEGER NOT NULL DEFAULT 1;

-- Boleto: marca de regalo + número del boleto manual que lo generó.
ALTER TABLE "TicketNumber" ADD COLUMN "isGift" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TicketNumber" ADD COLUMN "parentNumber" INTEGER;

-- Índice para muestrear rápido el pool de regalos disponibles por rifa.
CREATE INDEX "TicketNumber_raffleId_isGift_status_idx" ON "TicketNumber"("raffleId", "isGift", "status");
