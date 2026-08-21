-- Verificación de dominio de Meta: el valor de `content` de la meta etiqueta
-- <meta name="facebook-domain-verification" content="...">. El backend la inyecta
-- en el <head> de las páginas públicas. NULL = no se inyecta nada.
ALTER TABLE "RiferoProfile" ADD COLUMN "facebookDomainVerification" TEXT;
