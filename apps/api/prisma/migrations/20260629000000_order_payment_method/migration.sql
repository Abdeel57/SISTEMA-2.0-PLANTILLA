-- Método y detalle del pago de la orden, capturados al confirmar el pago
-- (efectivo / transferencia / depósito / etc.) + nota opcional.
-- Opcionales: las órdenes existentes quedan en NULL.
ALTER TABLE "Order" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Order" ADD COLUMN "paymentNote" TEXT;
