-- Índice para el sondeo en vivo de cambios de boletos
-- (GET /api/public/raffles/:id/ticket-changes?since=...). Sin él, con rifas de
-- hasta 1,000,000 de boletos cada consulta barría todos los boletos de la rifa.
CREATE INDEX "TicketNumber_raffleId_updatedAt_idx" ON "TicketNumber"("raffleId", "updatedAt");
