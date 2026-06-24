-- Recepción de comprobantes activa por defecto.
-- En el modelo single-tenant "todo está activo"; `allowProofUpload` venía en
-- `false` como vestigio del antiguo modelo SaaS, lo que impedía subir el
-- comprobante de pago en instalaciones nuevas. Cambiamos el default y corregimos
-- los perfiles existentes que quedaron en `false`.
ALTER TABLE "RiferoProfile" ALTER COLUMN "allowProofUpload" SET DEFAULT true;
UPDATE "RiferoProfile" SET "allowProofUpload" = true WHERE "allowProofUpload" = false;
