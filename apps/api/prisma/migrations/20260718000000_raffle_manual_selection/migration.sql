-- Selección manual de boletos por rifa: true (default) = cuadrícula normal;
-- false = solo la maquinita de la suerte en la página pública.
ALTER TABLE "Raffle" ADD COLUMN "manualSelection" BOOLEAN NOT NULL DEFAULT true;
