-- Números de WhatsApp del organizador con país (define la lada +52/+1) y nombre
-- de quien atiende. Aplica al número de contacto y al de comprobantes.
ALTER TABLE "RiferoProfile" ADD COLUMN "whatsappCountry" TEXT NOT NULL DEFAULT 'MX';
ALTER TABLE "RiferoProfile" ADD COLUMN "whatsappName" TEXT;
ALTER TABLE "RiferoProfile" ADD COLUMN "payWhatsappCountry" TEXT NOT NULL DEFAULT 'MX';
ALTER TABLE "RiferoProfile" ADD COLUMN "payWhatsappName" TEXT;
