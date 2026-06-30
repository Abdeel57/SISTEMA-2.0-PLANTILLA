-- Interruptor de liberación automática de apartados vencidos (por rifero).
-- true (default) = el job libera los boletos al expirar el apartado sin pago.
-- false = nada se libera automáticamente; el rifero lo gestiona manualmente.
ALTER TABLE "RiferoProfile" ADD COLUMN "autoReleaseExpired" BOOLEAN NOT NULL DEFAULT true;
