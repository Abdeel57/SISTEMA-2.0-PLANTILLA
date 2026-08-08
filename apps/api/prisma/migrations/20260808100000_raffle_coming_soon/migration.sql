-- "Próximamente": la rifa se anuncia en la página pública (foto, premio y fecha)
-- pero todavía no se pueden apartar boletos.
ALTER TABLE "Raffle" ADD COLUMN "comingSoon" BOOLEAN NOT NULL DEFAULT false;
