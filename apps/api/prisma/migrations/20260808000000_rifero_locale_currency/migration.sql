-- Modo USA: idioma de lo que ve el comprador y moneda en la que se cobra.
-- Los valores por defecto conservan el comportamiento actual (español / pesos).
ALTER TABLE "RiferoProfile" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'es';
ALTER TABLE "RiferoProfile" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'MXN';
