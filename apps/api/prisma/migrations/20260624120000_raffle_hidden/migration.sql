-- Visibilidad de rifas en la página pública.
-- Una rifa PUBLISHED puede ocultarse del sitio (hidden=true) sin cancelarla.
-- Las rifas existentes quedan visibles (default false).
ALTER TABLE "Raffle" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
