-- Pixel de Facebook (Meta) del rifero: solo el ID numérico, configurable desde
-- el panel. Vacío/NULL = las páginas públicas no cargan ningún pixel.
ALTER TABLE "RiferoProfile" ADD COLUMN "facebookPixelId" TEXT;
