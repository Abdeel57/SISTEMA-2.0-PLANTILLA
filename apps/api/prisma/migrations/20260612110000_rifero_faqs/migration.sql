-- Preguntas frecuentes personalizables de la página pública del rifero.
-- Lista JSON de {q, a}; vacía = se muestran las preguntas por defecto.
ALTER TABLE "RiferoProfile" ADD COLUMN "faqs" JSONB NOT NULL DEFAULT '[]';
